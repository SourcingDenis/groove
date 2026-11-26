import { defaultParams, type SoundParams, type TrackKind } from './model';

export interface KickCfg { kind: 'kick'; base: number; pitchDecay: number; octaves: number; decay: number; wave: 'sine' | 'triangle' }
export interface NoiseCfg { kind: 'snare' | 'hat'; noise: 'white' | 'pink' | 'brown'; decay: number; hp: number }
export interface BassCfg { kind: 'bass'; osc: 'sine' | 'sawtooth' | 'square' | 'fatsawtooth'; Q: number; base: number; octaves: number; decay: number; sustain: number; release: number }
export interface LeadCfg { kind: 'lead'; osc: 'square' | 'sawtooth' | 'triangle'; Q: number; base: number; octaves: number; sustain: number; release: number; portamento: number }
export interface ChordCfg { kind: 'chord'; osc: 'sawtooth' | 'triangle' | 'square' | 'fatsawtooth'; attack: number; decay: number; sustain: number; release: number; level: number }
export interface BellCfg { kind: 'bell'; harmonicity: number; modulationIndex: number; decay: number; release: number; modulation: 'square' | 'sine' }
export interface SamplerCfg { kind: 'sampler' }

export type VoiceConfig = KickCfg | NoiseCfg | BassCfg | LeadCfg | ChordCfg | BellCfg | SamplerCfg;

export interface Preset {
  id: string;
  name: string;
  config: VoiceConfig;
  /** macro values the preset starts with (the rest stay at their defaults) */
  params?: Partial<SoundParams>;
}

/** A user-saved sound: a built-in preset plus the macro values and arp it was saved with. */
export interface UserPreset {
  id: string;
  kind: TrackKind;
  name: string;
  preset: string;
  params: SoundParams;
  arp: string;
}

/** Drum kits swap kick, snare and hat together; the preset ids below match the kit ids. */
export const KITS = [
  { id: '808', name: '808' },
  { id: '909', name: '909' },
  { id: 'lofi', name: 'Lo-fi' },
] as const;

export const PRESETS: Record<TrackKind, Preset[]> = {
  kick: [
    { id: '808', name: '808', config: { kind: 'kick', base: 24, pitchDecay: 0.03, octaves: 3, decay: 0.9, wave: 'sine' } },
    { id: '909', name: '909', config: { kind: 'kick', base: 27, pitchDecay: 0.05, octaves: 6, decay: 0.32, wave: 'sine' } },
    { id: 'lofi', name: 'Lo-fi', config: { kind: 'kick', base: 26, pitchDecay: 0.04, octaves: 4, decay: 0.22, wave: 'triangle' }, params: { tone: 0.6 } },
  ],
  snare: [
    { id: '808', name: '808', config: { kind: 'snare', noise: 'pink', decay: 0.22, hp: 500 } },
    { id: '909', name: '909', config: { kind: 'snare', noise: 'white', decay: 0.16, hp: 900 } },
    { id: 'lofi', name: 'Lo-fi', config: { kind: 'snare', noise: 'brown', decay: 0.2, hp: 250 }, params: { tone: 0.55 } },
  ],
  hat: [
    { id: '808', name: '808', config: { kind: 'hat', noise: 'white', decay: 0.05, hp: 8000 } },
    { id: '909', name: '909', config: { kind: 'hat', noise: 'white', decay: 0.07, hp: 7000 } },
    { id: 'lofi', name: 'Lo-fi', config: { kind: 'hat', noise: 'pink', decay: 0.045, hp: 4500 }, params: { tone: 0.7 } },
  ],
  bass: [
    { id: 'saw', name: 'Saw', config: { kind: 'bass', osc: 'sawtooth', Q: 2, base: 120, octaves: 3, decay: 0.2, sustain: 0.35, release: 0.15 } },
    { id: 'sub', name: 'Sub', config: { kind: 'bass', osc: 'sine', Q: 0.5, base: 400, octaves: 1, decay: 0.3, sustain: 0.8, release: 0.2 } },
    { id: 'reese', name: 'Reese', config: { kind: 'bass', osc: 'fatsawtooth', Q: 3, base: 150, octaves: 2, decay: 0.3, sustain: 0.7, release: 0.2 } },
    { id: 'pluck', name: 'Pluck', config: { kind: 'bass', osc: 'square', Q: 4, base: 200, octaves: 3, decay: 0.12, sustain: 0, release: 0.08 } },
    { id: 'acid', name: 'Acid', config: { kind: 'bass', osc: 'sawtooth', Q: 12, base: 180, octaves: 4, decay: 0.15, sustain: 0.2, release: 0.1 } },
  ],
  lead: [
    { id: 'square', name: 'Square', config: { kind: 'lead', osc: 'square', Q: 3, base: 500, octaves: 3, sustain: 0.5, release: 0.2, portamento: 0.02 } },
    { id: 'saw', name: 'Saw', config: { kind: 'lead', osc: 'sawtooth', Q: 2, base: 800, octaves: 3, sustain: 0.6, release: 0.25, portamento: 0.03 } },
    { id: 'soft', name: 'Soft', config: { kind: 'lead', osc: 'triangle', Q: 1, base: 1200, octaves: 2, sustain: 0.7, release: 0.3, portamento: 0.05 } },
  ],
  chord: [
    { id: 'pad', name: 'Pad', config: { kind: 'chord', osc: 'sawtooth', attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.5, level: -8 } },
    { id: 'keys', name: 'Keys', config: { kind: 'chord', osc: 'triangle', attack: 0.005, decay: 0.35, sustain: 0.1, release: 0.3, level: -4 } },
    { id: 'organ', name: 'Organ', config: { kind: 'chord', osc: 'square', attack: 0.01, decay: 0.05, sustain: 0.8, release: 0.15, level: -12 } },
  ],
  bell: [
    { id: 'bell', name: 'Bell', config: { kind: 'bell', harmonicity: 3.01, modulationIndex: 14, decay: 0.8, release: 1.2, modulation: 'square' } },
    { id: 'marimba', name: 'Marimba', config: { kind: 'bell', harmonicity: 5, modulationIndex: 4, decay: 0.35, release: 0.4, modulation: 'sine' } },
    { id: 'glass', name: 'Glass', config: { kind: 'bell', harmonicity: 1.5, modulationIndex: 8, decay: 1.4, release: 1.8, modulation: 'sine' } },
  ],
  sampler: [{ id: 'default', name: 'Sampler', config: { kind: 'sampler' } }],
};

export function getPreset(kind: TrackKind, id: string): Preset {
  return PRESETS[kind].find((p) => p.id === id) ?? PRESETS[kind][0];
}

/** Macro values a preset starts with. */
export const presetParams = (p: Preset): SoundParams => ({ ...defaultParams(), ...p.params });
