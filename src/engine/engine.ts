import * as Tone from 'tone';
import type { Project } from '../model';
import type { Store } from '../store/store';
import { setupContext, unlock } from './context';
import { createVoice, type Voice } from './instruments';
import { resolvePattern, triggersAt } from './sequencer';

export interface PlayPosition {
  step: number;
  pattern: number;
}

/**
 * Tone.js engine. One transport callback per 16th note reads the live project from the
 * store and triggers every audible track. The callback never touches the DOM; the UI is
 * notified through Tone's Draw so the playhead lines up with what you hear.
 */
export class Engine {
  private voices: Voice[] = [];
  private channels: Tone.Channel[] = [];
  private master?: Tone.ToneAudioNode;
  private builtFor = '';
  private eventId?: number;

  private step = 0;
  private playing = 0;
  private queued: number | null = null;
  private running = false;

  onPosition: (pos: PlayPosition) => void = () => {};

  constructor(private store: Store) {
    store.subscribe((p) => this.sync(p));
  }

  get isPlaying() { return this.running; }

  /** Call from a user gesture. */
  async play() {
    await unlock();
    this.build(this.store.get());
    const t = Tone.getTransport();
    this.step = 0;
    this.playing = this.store.get().current;
    this.queued = null;
    this.eventId ??= t.scheduleRepeat((time) => this.tick(time), '16n');
    t.start('+0.05');
    this.running = true;
  }

  stop() {
    const t = Tone.getTransport();
    t.stop();
    t.cancel(0);
    this.eventId = undefined;
    for (const v of this.voices) (v.node as { releaseAll?: (t?: number) => void }).releaseAll?.();
    this.running = false;
    this.step = 0;
    this.queued = null;
    this.onPosition({ step: -1, pattern: this.playing });
  }

  /** Quantised to the bar while playing; immediate when stopped. */
  queuePattern(i: number) {
    if (this.running) this.queued = i;
    else this.store.selectPattern(i);
  }

  get queuedPattern() { return this.queued; }

  private build(p: Project) {
    // rebuild the graph only if the track layout changed
    const sig = p.tracks.map((t) => t.kind).join();
    if (sig === this.builtFor) return;
    setupContext();
    this.voices.forEach((v) => v.dispose());
    this.channels.forEach((c) => c.dispose());
    this.master?.dispose();

    const limiter = new Tone.Limiter(-1).toDestination();
    const comp = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.01, release: 0.2 }).connect(limiter);
    this.master = comp;

    this.voices = p.tracks.map((t) => createVoice(t.kind));
    this.channels = this.voices.map((v) => {
      const ch = new Tone.Channel({ volume: 0 }).connect(comp);
      v.node.connect(ch);
      return ch;
    });
    this.builtFor = sig;
    this.sync(p);
  }

  private sync(p: Project) {
    const t = Tone.getTransport();
    t.bpm.value = p.bpm;
    t.swing = p.swing;
    t.swingSubdivision = '16n';
    p.tracks.forEach((track, i) => {
      if (this.channels[i]) this.channels[i].volume.value = track.vol;
    });
  }

  private tick(time: number) {
    const project = this.store.get();
    const pattern = resolvePattern(this.playing, this.queued, this.step);
    if (pattern !== this.playing) {
      this.playing = pattern;
      this.queued = null;
    }
    const length = project.patterns[pattern]?.length ?? 16;
    const step = this.step % length;

    for (const trig of triggersAt(project, pattern, step)) {
      this.voices[trig.track]?.trigger(time, trig.vel, trig.notes);
    }

    const pos = { step, pattern };
    Tone.getDraw().schedule(() => {
      this.onPosition(pos);
      if (this.store.get().current !== pos.pattern) this.store.selectPattern(pos.pattern);
    }, time);

    this.step = (step + 1) % length;
  }
}
