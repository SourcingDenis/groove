import type { Project, SongEntry } from '../model';

export interface Trigger {
  track: number;
  notes: number[];
  vel: number;
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
    if (s?.on && audible[track]) out.push({ track, notes: s.notes, vel: s.vel });
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
