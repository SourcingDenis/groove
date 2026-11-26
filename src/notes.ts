const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI 60 -> "C4" */
export function noteName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export const pitchClassName = (pc: number) => NAMES[((pc % 12) + 12) % 12];
export const isBlackKey = (pc: number) => [1, 3, 6, 8, 10].includes(((pc % 12) + 12) % 12);
