const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI 60 -> "C4" */
export function noteName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export const pitchClassName = (pc: number) => NAMES[((pc % 12) + 12) % 12];
export const isBlackKey = (pc: number) => [1, 3, 6, 8, 10].includes(((pc % 12) + 12) % 12);

export type ChordType = 'maj' | 'min' | '7' | 'm7' | 'sus4';
export const CHORDS: Record<ChordType, { label: string; intervals: number[] }> = {
  maj: { label: 'Maj', intervals: [0, 4, 7] },
  min: { label: 'min', intervals: [0, 3, 7] },
  '7': { label: '7', intervals: [0, 4, 7, 10] },
  m7: { label: 'm7', intervals: [0, 3, 7, 10] },
  sus4: { label: 'sus4', intervals: [0, 5, 7] },
};

export const chordNotes = (root: number, type: ChordType): number[] => CHORDS[type].intervals.map((i) => root + i);
