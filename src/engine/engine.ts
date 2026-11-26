import * as Tone from 'tone';
import type { Project } from '../model';
import type { Store } from '../store/store';
import { setupContext, unlock } from './context';
import { createVoice, type Voice } from './instruments';
import { getSample } from './samples';
import { advanceSong, expandHits, resolvePattern, triggersAt } from './sequencer';

export interface PlayPosition {
  step: number;
  pattern: number;
  songIndex: number;
}

export type PerfMode = 'filter' | 'delay' | 'reverb';

const DELAY_FEEDBACK = 0.4;
const REVERB_BRIGHT = 18000;

/**
 * Tone.js engine. One transport callback per 16th note reads the live project from the
 * store and triggers every audible track. The callback never touches the DOM; the UI is
 * notified through Tone's Draw so the playhead lines up with what you hear.
 *
 * `offline` engines are built inside `Tone.Offline` for WAV rendering: same graph, no
 * Draw, no unlock, nothing shared with the live engine.
 */
export class Engine {
  private voices: Voice[] = [];
  private channels: Tone.Channel[] = [];
  private meters: Tone.Meter[] = [];
  private sendA: Tone.Gain[] = [];
  private sendB: Tone.Gain[] = [];
  private nodes: Tone.ToneAudioNode[] = [];
  private builtFor = '';
  private built = false;

  private transport!: ReturnType<typeof Tone.getTransport>;
  private perfFilter!: Tone.Filter;
  private perfDelaySend!: Tone.Gain;
  private perfRevSend!: Tone.Gain;
  private delay!: Tone.FeedbackDelay;
  private revReturn!: Tone.Filter;
  private reverb!: Tone.Reverb;
  private analyser?: Tone.Analyser;
  private recorder?: Tone.Recorder;

  private step = 0;
  private playing = 0;
  private queued: number | null = null;
  private running = false;
  private first = true;
  private songIdx = 0;
  private songRep = 0;
  private repeatLen: number | null = null;
  private repeatAnchor = -1;
  private repeatCount = 0;

  onPosition: (pos: PlayPosition) => void = () => {};

  constructor(private store: Store, private offline = false) {
    store.subscribe((p) => this.sync(p));
  }

  get isPlaying() { return this.running; }
  get queuedPattern() { return this.queued; }

  /** Call from a user gesture. Builds the audio graph on first use. */
  async ensureBuilt() {
    if (!this.offline) await unlock();
    this.build(this.store.get());
    await this.reverb.ready;
  }

  async play() {
    await this.ensureBuilt();
    const project = this.store.get();
    this.resetPosition(project);
    this.transport.cancel(0);
    this.transport.scheduleRepeat((time) => this.tick(time), '16n');
    this.transport.start('+0.05');
    this.running = true;
  }

  /** Offline rendering: start the transport at 0 of the offline clock. */
  startAt(seconds: number) {
    this.resetPosition(this.store.get());
    this.transport.cancel(0);
    this.transport.scheduleRepeat((time) => this.tick(time), '16n');
    this.transport.start(seconds);
    this.running = true;
  }

  stop() {
    this.transport.stop();
    this.transport.cancel(0);
    this.running = false;
    this.step = 0;
    this.queued = null;
    this.setRepeat(null);
    this.setPerf(null, 0, 0);
    this.onPosition({ step: -1, pattern: this.playing, songIndex: -1 });
  }

  /** Quantised to the bar while playing; immediate when stopped. */
  queuePattern(i: number) {
    if (this.running) this.queued = i;
    else this.store.selectPattern(i);
  }

  /** Level 0..1 per track, for meters. */
  levels(): number[] {
    return this.meters.map((m) => {
      const v = m.getValue() as number;
      return v <= -60 ? 0 : Math.min(1, (v + 60) / 60);
    });
  }

  /** FFT bins in dB (64), or null before the graph exists. */
  bins(): Float32Array | null {
    return this.analyser ? (this.analyser.getValue() as Float32Array) : null;
  }

  /** Play one hit of a track right now (sample slice audition). */
  async audition(track: number, notes: number[]) {
    await this.ensureBuilt();
    this.voices[track]?.trigger(Tone.now() + 0.01, 1, notes);
  }

  /** Hold-to-stutter: loop the last `steps` steps while held; null releases. */
  setRepeat(steps: number | null) {
    this.repeatLen = steps;
    if (steps === null) {
      this.repeatAnchor = -1;
      this.repeatCount = 0;
    }
  }

  /** XY performance FX on the master. x and y are 0..1 (y = 1 at the top); null mode resets. */
  setPerf(mode: PerfMode | null, x: number, y: number) {
    if (!this.built) return;
    const ramp = 0.03;
    let cutoff = 20000;
    let q = 0.7;
    let delaySend = 0;
    let feedback = DELAY_FEEDBACK;
    let revSend = 0;
    let bright = REVERB_BRIGHT;
    if (mode === 'filter') {
      cutoff = 80 * Math.pow(20000 / 80, x);
      q = 0.7 + y * 10;
    } else if (mode === 'delay') {
      delaySend = y;
      feedback = 0.3 + x * 0.6;
    } else if (mode === 'reverb') {
      revSend = x * 1.2;
      bright = 400 * Math.pow(REVERB_BRIGHT / 400, y);
    }
    this.perfFilter.frequency.rampTo(cutoff, ramp);
    this.perfFilter.Q.rampTo(q, ramp);
    this.perfDelaySend.gain.rampTo(delaySend, ramp);
    this.delay.feedback.rampTo(feedback, ramp);
    this.perfRevSend.gain.rampTo(revSend, ramp);
    this.revReturn.frequency.rampTo(bright, ramp);
  }

  async startRecording() {
    await this.ensureBuilt();
    await this.recorder?.start();
  }

  /** Resolves with the recorded container blob (webm/ogg/mp4 depending on browser). */
  async stopRecording(): Promise<Blob> {
    if (!this.recorder) throw new Error('not recording');
    return this.recorder.stop();
  }

  private resetPosition(project: Project) {
    this.step = 0;
    this.first = true;
    this.queued = null;
    this.songIdx = 0;
    this.songRep = 0;
    this.playing = project.songMode && project.song.length ? project.song[0].pattern : project.current;
  }

  private build(p: Project) {
    // rebuild the graph only if the track layout changed
    const sig = p.tracks.map((t) => t.kind).join();
    if (sig === this.builtFor) return;
    if (!this.offline) setupContext();
    this.teardown();

    this.transport = Tone.getTransport();
    const limiter = new Tone.Limiter(-1).toDestination();
    const comp = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.01, release: 0.2 }).connect(limiter);
    this.perfFilter = new Tone.Filter(20000, 'lowpass').connect(comp);
    const master = new Tone.Gain(1).connect(this.perfFilter);
    const dry = new Tone.Gain(1).connect(master);

    this.delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: DELAY_FEEDBACK, wet: 1 }).connect(master);
    this.reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01, wet: 1 });
    this.revReturn = new Tone.Filter(REVERB_BRIGHT, 'lowpass').connect(master);
    this.reverb.connect(this.revReturn);
    this.perfDelaySend = new Tone.Gain(0).connect(this.delay);
    this.perfRevSend = new Tone.Gain(0).connect(this.reverb);
    dry.connect(this.perfDelaySend);
    dry.connect(this.perfRevSend);

    this.analyser = new Tone.Analyser('fft', 64);
    limiter.connect(this.analyser);
    this.recorder = this.offline ? undefined : new Tone.Recorder();
    if (this.recorder) limiter.connect(this.recorder);

    this.nodes.push(limiter, comp, master, dry, this.delay, this.reverb, this.revReturn,
      this.perfFilter, this.perfDelaySend, this.perfRevSend, this.analyser);
    if (this.recorder) this.nodes.push(this.recorder);

    this.voices = p.tracks.map((t, i) =>
      createVoice(t.kind, () => {
        const tr = this.store.get().tracks[i];
        return { buffer: getSample(tr.sample), slices: tr.slices };
      }),
    );
    this.voices.forEach((v) => {
      const ch = new Tone.Channel({ volume: 0 }).connect(dry);
      const a = new Tone.Gain(0).connect(this.delay);
      const b = new Tone.Gain(0).connect(this.reverb);
      const meter = new Tone.Meter({ smoothing: 0.8 });
      v.node.connect(ch);
      ch.connect(a);
      ch.connect(b);
      ch.connect(meter);
      this.channels.push(ch);
      this.sendA.push(a);
      this.sendB.push(b);
      this.meters.push(meter);
    });
    this.builtFor = sig;
    this.built = true;
    this.sync(p);
  }

  private teardown() {
    this.voices.forEach((v) => v.dispose());
    [...this.channels, ...this.sendA, ...this.sendB, ...this.meters, ...this.nodes].forEach((n) => n.dispose());
    this.voices = [];
    this.channels = [];
    this.sendA = [];
    this.sendB = [];
    this.meters = [];
    this.nodes = [];
  }

  private sync(p: Project) {
    if (!this.built) return;
    this.transport.bpm.value = p.bpm;
    this.transport.swing = p.swing;
    this.transport.swingSubdivision = '16n';
    p.tracks.forEach((track, i) => {
      if (!this.channels[i]) return;
      this.channels[i].volume.value = track.vol;
      this.channels[i].pan.value = track.pan;
      this.sendA[i].gain.value = track.sendA;
      this.sendB[i].gain.value = track.sendB;
      this.voices[i].setParams(track.params);
    });
  }

  private tick(time: number) {
    const project = this.store.get();
    const songOn = project.songMode && project.song.length > 0;
    let pattern: number;

    if (songOn) {
      if (this.step === 0 && !this.first) {
        const n = advanceSong(project.song, this.songIdx, this.songRep);
        this.songIdx = n.idx;
        this.songRep = n.rep;
      }
      if (this.songIdx >= project.song.length) { this.songIdx = 0; this.songRep = 0; }
      pattern = project.song[this.songIdx].pattern;
      this.queued = null;
    } else {
      pattern = resolvePattern(this.playing, this.queued, this.step);
      if (pattern !== this.playing) this.queued = null;
    }
    this.playing = pattern;
    this.first = false;

    const length = project.patterns[pattern]?.length ?? 16;
    const step = this.step % length;

    // beat repeat: keep the clock running, but re-trigger the last N steps
    let heard = step;
    if (this.repeatLen !== null) {
      if (this.repeatAnchor < 0) {
        this.repeatAnchor = (step - this.repeatLen + length) % length;
        this.repeatCount = 0;
      }
      heard = (this.repeatAnchor + (this.repeatCount % this.repeatLen)) % length;
      this.repeatCount++;
    }

    const stepSeconds = 60 / project.bpm / 4;
    const floor = this.transport.context.currentTime + 0.002; // a rushed hit can't land in the past
    for (const trig of triggersAt(project, pattern, heard)) {
      for (const h of expandHits(trig, stepSeconds)) {
        this.voices[trig.track]?.trigger(Math.max(time + h.offset, floor), h.vel, h.notes);
      }
    }

    if (!this.offline) {
      const pos = { step, pattern, songIndex: songOn ? this.songIdx : -1 };
      Tone.getDraw().schedule(() => {
        this.onPosition(pos);
        if (this.store.get().current !== pos.pattern) this.store.selectPattern(pos.pattern);
      }, time);
    }

    this.step = (step + 1) % length;
  }
}
