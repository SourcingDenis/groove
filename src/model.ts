export type TrackKind = 'kick' | 'snare' | 'hat' | 'bass' | 'sampler';

export interface Step {
  on: boolean;
  /** MIDI note numbers for bass; slice index (0-based) for the sampler; ignored by drums. */
  notes: number[];
  /** 0..1 */
  vel: number;
}

/** Macro knobs shown on the Sound page. Which ones apply depends on the track kind (see MACROS). */
export interface SoundParams {
  tune: number; // semitones
  decay: number; // 0..1, 0.5 = default length
  tone: number; // 0..1 brightness (low-pass)
}

export interface Track {
  name: string;
  kind: TrackKind;
  /** dB */
  vol: number;
  /** -1..1 */
  pan: number;
  /** 0..1 send levels: A = delay, B = reverb */
  sendA: number;
  sendB: number;
  params: SoundParams;
  muted: boolean;
  solo: boolean;
  /** sampler only: id of a Blob in IndexedDB */
  sample: string | null;
  sampleName: string;
  slices: number;
}

export interface Pattern {
  name: string;
  length: number;
  /** steps[trackIndex][stepIndex] */
  steps: Step[][];
}

export interface SongEntry {
  pattern: number;
  repeats: number;
}

export interface Project {
  version: number;
  bpm: number;
  swing: number;
  tracks: Track[];
  patterns: Pattern[];
  /** pattern currently being edited / playing */
  current: number;
  song: SongEntry[];
  songMode: boolean;
}

export const PROJECT_VERSION = 2;
export const PATTERN_COUNT = 16;
export const STEPS = 16;
export const BASS_DEFAULT_NOTE = 36; // C2
export const SLICE_OPTIONS = [1, 4, 8, 16];

export interface Macro {
  key: keyof SoundParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

const TUNE: Macro = { key: 'tune', label: 'Тон', min: -12, max: 12, step: 1 };
const DECAY: Macro = { key: 'decay', label: 'Довжина', min: 0, max: 1, step: 0.01 };
const TONE: Macro = { key: 'tone', label: 'Яскравість', min: 0, max: 1, step: 0.01 };

export const MACROS: Record<TrackKind, Macro[]> = {
  kick: [TUNE, DECAY, TONE],
  snare: [DECAY, TONE],
  hat: [DECAY, TONE],
  bass: [TUNE, DECAY, TONE],
  sampler: [TUNE, DECAY, TONE],
};

const PATTERN_NAMES = [
  'Intro', 'First Light', 'Enter', 'Build', 'Lift', 'Rise', 'Sunrise', 'Sunrise II',
  'Break', 'Drop', 'Groove', 'Twist', 'Return', 'Peak', 'Fade', 'Close',
];

export const defaultParams = (): SoundParams => ({ tune: 0, decay: 0.5, tone: 1 });

export const emptyStep = (): Step => ({ on: false, notes: [], vel: 0.9 });

export function emptyPattern(name: string, trackCount: number, length = STEPS): Pattern {
  return {
    name,
    length,
    steps: Array.from({ length: trackCount }, () => Array.from({ length }, emptyStep)),
  };
}

function track(name: string, kind: TrackKind, vol: number, sendA = 0, sendB = 0): Track {
  return {
    name, kind, vol, pan: 0, sendA, sendB, params: defaultParams(), muted: false, solo: false,
    sample: null, sampleName: '', slices: 8,
  };
}

export function defaultProject(): Project {
  const tracks: Track[] = [
    track('Kick', 'kick', -4),
    track('Snare', 'snare', -8, 0.1, 0.15),
    track('Hat', 'hat', -18, 0.15),
    track('Bass', 'bass', -8),
    track('Sample', 'sampler', -6, 0.1, 0.1),
  ];
  const patterns = PATTERN_NAMES.map((n) => emptyPattern(n, tracks.length));
  // seed the first pattern with a basic beat so Play makes sound immediately
  const p = patterns[0];
  for (const i of [0, 4, 8, 12]) p.steps[0][i] = { on: true, notes: [], vel: 1 };
  for (const i of [4, 12]) p.steps[1][i] = { on: true, notes: [], vel: 0.9 };
  for (let i = 0; i < STEPS; i += 2) p.steps[2][i] = { on: true, notes: [], vel: i % 4 === 2 ? 0.8 : 0.5 };
  for (const i of [0, 6, 10]) p.steps[3][i] = { on: true, notes: [BASS_DEFAULT_NOTE], vel: 0.9 };
  return { version: PROJECT_VERSION, bpm: 123, swing: 0, tracks, patterns, current: 0, song: [], songMode: false };
}
