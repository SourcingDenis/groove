export type TrackKind = 'kick' | 'snare' | 'hat' | 'bass' | 'lead' | 'chord' | 'bell' | 'sampler';

export type ArpMode = 'off' | 'up' | 'down' | 'updown' | 'random';
export const ARP_MODES: { id: ArpMode; label: string }[] = [
  { id: 'off', label: 'Вимк.' },
  { id: 'up', label: 'Вгору' },
  { id: 'down', label: 'Вниз' },
  { id: 'updown', label: 'Туди-сюди' },
  { id: 'random', label: 'Випадк.' },
];
/** Tracks the arpeggiator applies to (they take several notes per step). */
export const hasArp = (kind: TrackKind) => kind === 'chord' || kind === 'bell';

export interface Step {
  on: boolean;
  /** MIDI note numbers for melodic tracks; slice index (0-based) for the sampler; ignored by drums. */
  notes: number[];
  /** 0..1 */
  vel: number;
  /** 0..1 chance the step plays */
  prob: number;
  /** 1..4 evenly spaced hits inside the step */
  ratchet: number;
  /** -0.5..0.5 of a step: negative rushes, positive drags */
  nudge: number;
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
  arp: ArpMode;
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

export const PROJECT_VERSION = 3;
export const PATTERN_COUNT = 16;
export const STEPS = 16;
export const BASS_DEFAULT_NOTE = 36; // C2

/** Tracks that take several notes per step (the editor toggles notes instead of replacing). */
export const isPoly = (kind: TrackKind) => kind === 'chord' || kind === 'bell';

export const DEFAULT_NOTES: Partial<Record<TrackKind, number[]>> = {
  bass: [BASS_DEFAULT_NOTE],
  lead: [60],
  chord: [60, 64, 67],
  bell: [72],
};
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
  lead: [TUNE, DECAY, TONE],
  chord: [TUNE, DECAY, TONE],
  bell: [TUNE, DECAY, TONE],
  sampler: [TUNE, DECAY, TONE],
};

const PATTERN_NAMES = [
  'Intro', 'First Light', 'Enter', 'Build', 'Lift', 'Rise', 'Sunrise', 'Sunrise II',
  'Break', 'Drop', 'Groove', 'Twist', 'Return', 'Peak', 'Fade', 'Close',
];

export const defaultParams = (): SoundParams => ({ tune: 0, decay: 0.5, tone: 1 });

export const emptyStep = (): Step => ({ on: false, notes: [], vel: 0.9, prob: 1, ratchet: 1, nudge: 0 });

export const hit = (notes: number[] = [], vel = 0.9): Step => ({ ...emptyStep(), on: true, notes, vel });

export function emptyPattern(name: string, trackCount: number, length = STEPS): Pattern {
  return {
    name,
    length,
    steps: Array.from({ length: trackCount }, () => Array.from({ length }, emptyStep)),
  };
}

function track(name: string, kind: TrackKind, vol: number, sendA = 0, sendB = 0): Track {
  return {
    name, kind, vol, pan: 0, sendA, sendB, params: defaultParams(), arp: 'off', muted: false, solo: false,
    sample: null, sampleName: '', slices: 8,
  };
}

export function defaultProject(): Project {
  const tracks: Track[] = [
    track('Kick', 'kick', -4),
    track('Snare', 'snare', -8, 0.1, 0.15),
    track('Hat', 'hat', -18, 0.15),
    track('Bass', 'bass', -8),
    track('Lead', 'lead', -12, 0.15, 0.1),
    track('Chord', 'chord', -14, 0, 0.3),
    track('Bell', 'bell', -16, 0.2, 0.3),
    track('Sample', 'sampler', -6, 0.1, 0.1),
  ];
  const patterns = PATTERN_NAMES.map((n) => emptyPattern(n, tracks.length));
  // seed the first pattern with a basic beat so Play makes sound immediately
  const p = patterns[0];
  for (const i of [0, 4, 8, 12]) p.steps[0][i] = hit([], 1);
  for (const i of [4, 12]) p.steps[1][i] = hit([], 0.9);
  for (let i = 0; i < STEPS; i += 2) p.steps[2][i] = hit([], i % 4 === 2 ? 0.8 : 0.5);
  for (const i of [0, 6, 10]) p.steps[3][i] = hit([BASS_DEFAULT_NOTE], 0.9);
  p.steps[5][0] = hit([57, 60, 64], 0.8); // Am
  p.steps[5][8] = hit([53, 57, 60], 0.8); // F
  return { version: PROJECT_VERSION, bpm: 123, swing: 0, tracks, patterns, current: 0, song: [], songMode: false };
}
