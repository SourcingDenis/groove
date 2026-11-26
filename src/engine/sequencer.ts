import type { Project, SongEntry } from '../model';

export interface Trigger {
  track: number;
  notes: number[];
  vel: number;
  prob: number;
  ratchet: number;
  nudge: number;
}

/** One actual sound to start: `offset` seconds after the step's clock time. */
export interface Hit {
  offset: number;
  vel: number;
  notes: number[];
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** each ratchet hit is a little quieter than the last */
export const RATCHET_DECAY = 0.85;

/**
 * Turns one triggered step into the hits that should sound: applies the probability roll,
 * splits the step into `ratchet` equal sub-hits and shifts everything by `nudge`.
 * `rng` returns [0, 1); pass a fixed one in tests.
 */
export function expandHits(t: Trigger, stepSeconds: number, rng: () => number = Math.random): Hit[] {
  if (rng() >= clamp(t.prob, 0, 1)) return [];
  const n = clamp(Math.round(t.ratchet), 1, 4);
  const nudge = clamp(t.nudge, -0.5, 0.5) * stepSeconds;
  return Array.from({ length: n }, (_, k) => ({
    offset: nudge + (k * stepSeconds) / n,
    vel: t.vel * Math.pow(RATCHET_DECAY, k),
    notes: t.notes,
  }));
}

/** Which tracks are audible given mute/solo state. */
export function audibleTracks(project: Project): boolean[] {
  const anySolo = project.tracks.some((t) => t.solo);
  return project.tracks.map((t) => (anySolo ? t.solo : !t.muted));
}

/** Pure: what should sound at `step` of `patternIndex`. No audio, no clock. */
export function triggersAt(project: Project, patternIndex: number, step: number): Trigger[] {
  const pattern = project.patterns[patternIndex];
  if (!pattern) return [];
  const idx = step % pattern.length;
  const audible = audibleTracks(project);
  const out: Trigger[] = [];
  pattern.steps.forEach((row, track) => {
    const s = row[idx];
    if (s?.on && audible[track]) {
      out.push({ track, notes: s.notes, vel: s.vel, prob: s.prob ?? 1, ratchet: s.ratchet ?? 1, nudge: s.nudge ?? 0 });
    }
  });
  return out;
}

/**
 * Pattern changes are quantised to the bar: a queued pattern takes over when the
 * playhead wraps to step 0. Returns the pattern to play at `step`.
 */
export function resolvePattern(current: number, queued: number | null, step: number): number {
  return step === 0 && queued !== null ? queued : current;
}

/** Next position in the song chain after finishing one pass of the current entry. Wraps to the start. */
export function advanceSong(song: SongEntry[], idx: number, rep: number): { idx: number; rep: number } {
  if (song.length === 0) return { idx: 0, rep: 0 };
  const entry = song[idx];
  if (entry && rep + 1 < Math.max(1, entry.repeats)) return { idx, rep: rep + 1 };
  return { idx: (idx + 1) % song.length, rep: 0 };
}

/** Total length of one run through the song, in steps. */
export function songSteps(project: Project): number {
  return project.song.reduce((sum, e) => {
    const len = project.patterns[e.pattern]?.length ?? 0;
    return sum + len * Math.max(1, e.repeats);
  }, 0);
}
