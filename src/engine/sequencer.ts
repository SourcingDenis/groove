import type { ArpMode, Project, SongEntry } from '../model';

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

/** Which of `notes` (sorted ascending) the arpeggiator plays at sub-step `i`. */
export function arpNote(notes: number[], mode: ArpMode, i: number, rng: () => number = Math.random): number {
  const n = notes.length;
  if (n <= 1 || mode === 'off') return notes[0];
  if (mode === 'random') return notes[Math.min(n - 1, Math.floor(rng() * n))];
  const cycle = mode === 'updown' ? 2 * n - 2 : n;
  const k = ((i % cycle) + cycle) % cycle;
  if (mode === 'up') return notes[k];
  if (mode === 'down') return notes[n - 1 - k];
  return notes[k < n ? k : cycle - k]; // updown: 0..n-1, then back down to 1
}

export interface ArpOptions {
  mode: ArpMode;
  /** step position in the pattern; the arp advances one note per hit, so it runs across steps */
  stepIndex: number;
}

/**
 * Turns one triggered step into the hits that should sound: applies the probability roll,
 * splits the step into `ratchet` equal sub-hits and shifts everything by `nudge`.
 * `rng` returns [0, 1); pass a fixed one in tests.
 */
export function expandHits(t: Trigger, stepSeconds: number, rng: () => number = Math.random, arp?: ArpOptions): Hit[] {
  if (rng() >= clamp(t.prob, 0, 1)) return [];
  const n = clamp(Math.round(t.ratchet), 1, 4);
  const nudge = clamp(t.nudge, -0.5, 0.5) * stepSeconds;
  const arpeggiate = !!arp && arp.mode !== 'off' && t.notes.length > 1;
  return Array.from({ length: n }, (_, k) => ({
    offset: nudge + (k * stepSeconds) / n,
    vel: t.vel * Math.pow(RATCHET_DECAY, k),
    notes: arpeggiate ? [arpNote(t.notes, arp!.mode, arp!.stepIndex * n + k, rng)] : t.notes,
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

export interface DuckPoint {
  time: number;
  gain: number;
}

export const DUCK_ATTACK = 0.004;

/**
 * Gain automation for one kick: dive to `1 - amount` almost at once, then ramp back to 1
 * over `release` seconds. Returns the two ramp targets after the kick's own time.
 */
export function duckPoints(time: number, amount: number, release: number): [DuckPoint, DuckPoint] {
  const a = Math.min(1, Math.max(0, amount));
  const r = Math.max(0.01, release);
  return [
    { time: time + DUCK_ATTACK, gain: 1 - a },
    { time: time + DUCK_ATTACK + r, gain: 1 },
  ];
}
