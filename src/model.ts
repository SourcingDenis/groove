export type TrackKind = 'kick' | 'snare' | 'hat' | 'bass';

export interface Step {
  on: boolean;
  /** MIDI note numbers; used by melodic tracks, ignored by drums. */
  notes: number[];
  /** 0..1 */
  vel: number;
}

export interface Track {
  name: string;
  kind: TrackKind;
  /** dB */
  vol: number;
  muted: boolean;
  solo: boolean;
}

export interface Pattern {
  name: string;
  length: number;
  /** steps[trackIndex][stepIndex] */
  steps: Step[][];
}

export interface Project {
  bpm: number;
  swing: number;
  tracks: Track[];
  patterns: Pattern[];
  /** pattern currently being edited / playing */
  current: number;
}

export const PATTERN_COUNT = 16;
export const STEPS = 16;
export const BASS_DEFAULT_NOTE = 36; // C2

const PATTERN_NAMES = [
  'Intro', 'First Light', 'Enter', 'Build', 'Lift', 'Rise', 'Sunrise', 'Sunrise II',
  'Break', 'Drop', 'Groove', 'Twist', 'Return', 'Peak', 'Fade', 'Close',
];

export const emptyStep = (): Step => ({ on: false, notes: [], vel: 0.9 });

export function emptyPattern(name: string, trackCount: number, length = STEPS): Pattern {
  return {
    name,
    length,
    steps: Array.from({ length: trackCount }, () => Array.from({ length }, emptyStep)),
  };
}

export function defaultProject(): Project {
  const tracks: Track[] = [
    { name: 'Kick', kind: 'kick', vol: -4, muted: false, solo: false },
    { name: 'Snare', kind: 'snare', vol: -8, muted: false, solo: false },
    { name: 'Hat', kind: 'hat', vol: -18, muted: false, solo: false },
    { name: 'Bass', kind: 'bass', vol: -8, muted: false, solo: false },
  ];
  const patterns = PATTERN_NAMES.map((n) => emptyPattern(n, tracks.length));
  // seed the first pattern with a basic beat so Play makes sound immediately
  const p = patterns[0];
  for (const i of [0, 4, 8, 12]) p.steps[0][i] = { on: true, notes: [], vel: 1 };
  for (const i of [4, 12]) p.steps[1][i] = { on: true, notes: [], vel: 0.9 };
  for (let i = 0; i < STEPS; i += 2) p.steps[2][i] = { on: true, notes: [], vel: i % 4 === 2 ? 0.8 : 0.5 };
  for (const i of [0, 6, 10]) p.steps[3][i] = { on: true, notes: [BASS_DEFAULT_NOTE], vel: 0.9 };
  return { bpm: 123, swing: 0, tracks, patterns, current: 0 };
}
