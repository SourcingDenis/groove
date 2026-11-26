import * as Tone from 'tone';
import type { TrackKind } from '../model';

export interface Voice {
  node: Tone.ToneAudioNode;
  /** `time` is the audio-clock time from the transport callback. */
  trigger(time: number, vel: number, notes: number[]): void;
  dispose(): void;
}

const hz = (midi: number) => Tone.Frequency(midi, 'midi').toFrequency();

interface Single {
  node: Tone.ToneAudioNode;
  trigger(time: number, vel: number, notes: number[]): void;
  dispose(): void;
}

/**
 * Tone's monophonic synths schedule their stop (duration + release) ahead of time, and
 * starting the same source again before that stop throws. Rotating through a few
 * identical voices means a hit never lands on a voice that is still ringing out.
 */
function pooled(make: () => Single, size: number): Voice {
  const out = new Tone.Gain(1);
  const voices = Array.from({ length: size }, () => {
    const v = make();
    v.node.connect(out);
    return v;
  });
  let next = 0;
  return {
    node: out,
    trigger(time, vel, notes) {
      voices[next].trigger(time, vel, notes);
      next = (next + 1) % voices.length;
    },
    dispose() {
      voices.forEach((v) => v.dispose());
      out.dispose();
    },
  };
}

export function createVoice(kind: TrackKind): Voice {
  switch (kind) {
    case 'kick':
      return pooled(() => {
        const s = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } });
        return { node: s, trigger: (t, v) => s.triggerAttackRelease('C1', '16n', t, v), dispose: () => s.dispose() };
      }, 4);
    case 'snare':
      return pooled(() => {
        const s = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 } });
        return { node: s, trigger: (t, v) => s.triggerAttackRelease('16n', t, v), dispose: () => s.dispose() };
      }, 4);
    case 'hat':
      // Filtered noise instead of MetalSynth: MetalSynth throws on rapid retriggers above ~200 BPM.
      return pooled(() => {
        const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } });
        const hp = new Tone.Filter(7500, 'highpass');
        n.connect(hp);
        return { node: hp, trigger: (t, v) => n.triggerAttackRelease('32n', t, v), dispose: () => { n.dispose(); hp.dispose(); } };
      }, 4);
    case 'bass':
      return pooled(() => {
        const s = new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          filter: { Q: 2, type: 'lowpass', rolloff: -24 },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0.35, release: 0.15 },
          filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.15, baseFrequency: 120, octaves: 3 },
        });
        return { node: s, trigger: (t, v, notes) => s.triggerAttackRelease(hz(notes[0] ?? 36), '16n', t, v), dispose: () => s.dispose() };
      }, 3);
  }
}
