import * as Tone from 'tone';
import { defaultParams, type SoundParams, type TrackKind } from '../model';
import { getPreset, type BassCfg, type BellCfg, type ChordCfg, type KickCfg, type LeadCfg, type NoiseCfg } from '../presets';

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

/**
 * Polyphonic voices (chord, bell) don't need a pool: PolySynth hands each note its own
 * voice, so overlapping hits are fine.
 */
function poly(make: () => Tone.PolySynth, apply: (s: Tone.PolySynth, p: SoundParams) => void, gate: Tone.Unit.Time): Voice {
  const filter = new Tone.Filter(toneHz(1), 'lowpass');
  const synth = make();
  synth.maxPolyphony = 8;
  synth.connect(filter);
  let tune = 0;
  return {
    node: filter,
    trigger(time, vel, notes) {
      if (!notes.length) return;
      synth.triggerAttackRelease(notes.map((n) => hz(n + tune)), gate, time, vel);
    },
    setParams(p) {
      tune = p.tune;
      filter.frequency.value = toneHz(p.tone);
      apply(synth, p);
    },
    dispose() {
      synth.dispose();
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

function kick(c: KickCfg): Voice {
  return pooled(() => {
    const s = new Tone.MembraneSynth({
      pitchDecay: c.pitchDecay,
      octaves: c.octaves,
      oscillator: { type: c.wave },
      envelope: { attack: 0.001, decay: c.decay, sustain: 0, release: 0.1 },
    });
    let tune = 0;
    let gate = Math.min(0.5, c.decay);
    return {
      node: s,
      trigger: (t, v) => s.triggerAttackRelease(hz(c.base + tune), gate, t, v),
      setParams: (p) => {
        tune = p.tune;
        const d = c.decay * decayFactor(p.decay);
        s.envelope.decay = d;
        gate = Math.min(0.5, d); // a long 808 tail is cut at half a second so voices can recycle
      },
      dispose: () => s.dispose(),
    };
  }, 8);
}

function noise(c: NoiseCfg): Voice {
  return pooled(() => {
    const n = new Tone.NoiseSynth({ noise: { type: c.noise }, envelope: { attack: 0.001, decay: c.decay, sustain: 0, release: c.kind === 'hat' ? 0.02 : 0.08 } });
    const hp = new Tone.Filter(c.hp, 'highpass');
    n.connect(hp);
    return {
      node: hp,
      trigger: (t, v) => n.triggerAttackRelease(c.kind === 'hat' ? '32n' : '16n', t, v),
      setParams: (p) => { n.envelope.decay = c.decay * decayFactor(p.decay); },
      dispose: () => { n.dispose(); hp.dispose(); },
    };
  }, 6);
}

function bass(c: BassCfg): Voice {
  return pooled(() => {
    const s = new Tone.MonoSynth({
      oscillator: (c.osc === 'fatsawtooth' ? { type: c.osc, spread: 35, count: 3 } : { type: c.osc }) as never,
      filter: { Q: c.Q, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.005, decay: c.decay, sustain: c.sustain, release: c.release },
      filterEnvelope: { attack: 0.005, decay: c.decay, sustain: 0.1, release: c.release, baseFrequency: c.base, octaves: c.octaves },
    });
    let tune = 0;
    return {
      node: s,
      trigger: (t, v, notes) => s.triggerAttackRelease(hz((notes[0] ?? 36) + tune), '16n', t, v),
      setParams: (p) => { tune = p.tune; s.envelope.decay = c.decay * decayFactor(p.decay); },
      dispose: () => s.dispose(),
    };
  }, 3);
}

function lead(c: LeadCfg): Voice {
  return pooled(() => {
    const s = new Tone.MonoSynth({
      oscillator: { type: c.osc },
      portamento: c.portamento,
      filter: { Q: c.Q, type: 'lowpass', rolloff: -12 },
      envelope: { attack: 0.01, decay: 0.15, sustain: c.sustain, release: c.release },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: c.release, baseFrequency: c.base, octaves: c.octaves },
    });
    let tune = 0;
    return {
      node: s,
      trigger: (t, v, notes) => s.triggerAttackRelease(hz((notes[0] ?? 60) + tune), '16n', t, v),
      setParams: (p) => { tune = p.tune; s.envelope.decay = 0.15 * decayFactor(p.decay); },
      dispose: () => s.dispose(),
    };
  }, 3);
}

function chord(c: ChordCfg): Voice {
  return poly(
    () => {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: (c.osc === 'fatsawtooth' ? { type: c.osc, spread: 25, count: 3 } : { type: c.osc }) as never,
        envelope: { attack: c.attack, decay: c.decay, sustain: c.sustain, release: c.release },
      });
      s.volume.value = c.level; // three or four saws add up fast
      return s;
    },
    (s, p) => s.set({ envelope: { decay: c.decay * decayFactor(p.decay), release: c.release * decayFactor(p.decay) } }),
    '8n',
  );
}

function bell(c: BellCfg): Voice {
  return poly(
    () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: c.harmonicity,
        modulationIndex: c.modulationIndex,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: c.decay, sustain: 0, release: c.release },
        modulation: { type: c.modulation },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
      }),
    (s, p) => s.set({ envelope: { decay: c.decay * decayFactor(p.decay), release: c.release * decayFactor(p.decay) } }),
    '16n',
  );
}

export function createVoice(kind: TrackKind, presetId: string, source: SamplerSource): Voice {
  const cfg = getPreset(kind, presetId).config;
  switch (cfg.kind) {
    case 'kick': return kick(cfg);
    case 'snare':
    case 'hat': return noise(cfg);
    case 'bass': return bass(cfg);
    case 'lead': return lead(cfg);
    case 'chord': return chord(cfg);
    case 'bell': return bell(cfg);
    case 'sampler': return sampler(source);
  }
}
