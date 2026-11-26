import * as Tone from 'tone';
import { defaultParams, type SoundParams, type TrackKind } from '../model';

export interface Voice {
  node: Tone.ToneAudioNode;
  /** `time` is the audio-clock time from the transport callback. */
  trigger(time: number, vel: number, notes: number[]): void;
  setParams(p: SoundParams): void;
  dispose(): void;
}

interface Single {
  node: Tone.ToneAudioNode;
  trigger(time: number, vel: number, notes: number[]): void;
  setParams(p: SoundParams): void;
  dispose(): void;
}

export interface SamplerSource {
  (): { buffer: AudioBuffer | null; slices: number };
}

const hz = (midi: number) => Tone.Frequency(midi, 'midi').toFrequency();
/** decay 0.5 (the default) -> x1 */
const decayFactor = (d: number) => 0.25 + d * 1.5;
/** tone 0..1 -> 200 Hz .. 18 kHz low-pass */
const toneHz = (t: number) => 200 * Math.pow(90, t);

/**
 * Tone's monophonic synths schedule their stop (duration + release) ahead of time, and
 * starting the same source again before that stop throws. Rotating through a few
 * identical voices means a hit never lands on a voice that is still ringing out.
 */
function pooled(make: () => Single, size: number): Voice {
  const filter = new Tone.Filter(toneHz(1), 'lowpass');
  const voices = Array.from({ length: size }, () => {
    const v = make();
    v.node.connect(filter);
    return v;
  });
  let next = 0;
  return {
    node: filter,
    trigger(time, vel, notes) {
      voices[next].trigger(time, vel, notes);
      next = (next + 1) % voices.length;
    },
    setParams(p) {
      filter.frequency.value = toneHz(p.tone);
      voices.forEach((v) => v.setParams(p));
    },
    dispose() {
      voices.forEach((v) => v.dispose());
      filter.dispose();
    },
  };
}

function sampler(source: SamplerSource): Voice {
  const filter = new Tone.Filter(toneHz(1), 'lowpass');
  let p = defaultParams();
  return {
    node: filter,
    trigger(time, vel, notes) {
      const { buffer, slices } = source();
      if (!buffer) return;
      const n = Math.max(1, slices);
      const idx = Math.min(n - 1, Math.max(0, notes[0] ?? 0));
      const sliceDur = buffer.duration / n;
      const gate = Math.min(1, 0.1 + p.decay * 1.8) * sliceDur;
      // Tone.Offline restores the global context once rendering starts, so a source created
      // inside a transport callback must be told which context it belongs to.
      const src: Tone.ToneBufferSource = new Tone.ToneBufferSource({
        context: filter.context,
        url: buffer,
        playbackRate: Math.pow(2, p.tune / 12),
        fadeIn: 0.002,
        fadeOut: 0.01,
        onended: () => src.dispose(),
      });
      src.connect(filter);
      src.start(time, idx * sliceDur, gate, vel);
    },
    setParams(next) {
      p = next;
      filter.frequency.value = toneHz(next.tone);
    },
    dispose: () => filter.dispose(),
  };
}

export function createVoice(kind: TrackKind, source: SamplerSource): Voice {
  switch (kind) {
    case 'kick':
      return pooled(() => {
        const s = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } });
        let tune = 0;
        return {
          node: s,
          trigger: (t, v) => s.triggerAttackRelease(hz(24 + tune), '16n', t, v),
          setParams: (p) => { tune = p.tune; s.envelope.decay = 0.3 * decayFactor(p.decay); },
          dispose: () => s.dispose(),
        };
      }, 4);
    case 'snare':
      return pooled(() => {
        const s = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 } });
        return {
          node: s,
          trigger: (t, v) => s.triggerAttackRelease('16n', t, v),
          setParams: (p) => { s.envelope.decay = 0.14 * decayFactor(p.decay); },
          dispose: () => s.dispose(),
        };
      }, 4);
    case 'hat':
      // Filtered noise instead of MetalSynth: MetalSynth throws on rapid retriggers above ~200 BPM.
      return pooled(() => {
        const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } });
        const hp = new Tone.Filter(7500, 'highpass');
        n.connect(hp);
        return {
          node: hp,
          trigger: (t, v) => n.triggerAttackRelease('32n', t, v),
          setParams: (p) => { n.envelope.decay = 0.05 * decayFactor(p.decay); },
          dispose: () => { n.dispose(); hp.dispose(); },
        };
      }, 4);
    case 'bass':
      return pooled(() => {
        const s = new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          filter: { Q: 2, type: 'lowpass', rolloff: -24 },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0.35, release: 0.15 },
          filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.15, baseFrequency: 120, octaves: 3 },
        });
        let tune = 0;
        return {
          node: s,
          trigger: (t, v, notes) => s.triggerAttackRelease(hz((notes[0] ?? 36) + tune), '16n', t, v),
          setParams: (p) => { tune = p.tune; s.envelope.decay = 0.2 * decayFactor(p.decay); },
          dispose: () => s.dispose(),
        };
      }, 3);
    case 'sampler':
      return sampler(source);
  }
}
