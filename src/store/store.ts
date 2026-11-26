import { defaultProject, emptyPattern, type Project, type SoundParams, type Step } from '../model';

type Listener = (p: Project) => void;
const HISTORY_LIMIT = 100;

/** Single source of truth. Every edit is a command; each command is one undo step. */
export class Store {
  private project: Project;
  private past: Project[] = [];
  private future: Project[] = [];
  private listeners = new Set<Listener>();

  constructor(initial: Project = defaultProject()) {
    this.project = initial;
  }

  get(): Project {
    return this.project;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.project);
    return () => this.listeners.delete(fn);
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }

  private emit() {
    for (const l of this.listeners) l(this.project);
  }

  /** Apply an edit to a copy; `record` false = no undo entry (e.g. live knob drags, pattern switching). */
  private edit(fn: (draft: Project) => void, record = true) {
    const next = structuredClone(this.project);
    fn(next);
    if (record) {
      this.past.push(this.project);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
      this.future = [];
    }
    this.project = next;
    this.emit();
  }

  replace(p: Project) {
    this.project = p;
    this.past = [];
    this.future = [];
    this.emit();
  }

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.project);
    this.project = prev;
    this.emit();
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.project);
    this.project = next;
    this.emit();
  }

  /** `slice` is the sampler slice to place when switching a sampler step on. */
  toggleStep(track: number, step: number, slice = 0) {
    this.edit((p) => {
      const s = p.patterns[p.current].steps[track][step];
      s.on = !s.on;
      const kind = p.tracks[track].kind;
      if (s.on && kind === 'bass' && s.notes.length === 0) s.notes = [36];
      if (s.on && kind === 'sampler') s.notes = [slice];
    });
  }

  setStep(track: number, step: number, patch: Partial<Step>) {
    this.edit((p) => Object.assign(p.patterns[p.current].steps[track][step], patch));
  }

  setBpm(bpm: number) {
    this.edit((p) => { p.bpm = Math.min(300, Math.max(30, Math.round(bpm))); }, false);
  }

  selectPattern(i: number) {
    this.edit((p) => { p.current = i; }, false);
  }

  toggleMute(track: number) {
    this.edit((p) => { p.tracks[track].muted = !p.tracks[track].muted; }, false);
  }

  toggleSolo(track: number) {
    this.edit((p) => { p.tracks[track].solo = !p.tracks[track].solo; }, false);
  }

  clearPattern() {
    this.edit((p) => {
      const cur = p.patterns[p.current];
      p.patterns[p.current] = emptyPattern(cur.name, p.tracks.length, cur.length);
    });
  }

  private clipboard: Project['patterns'][number] | null = null;

  copyPattern() {
    this.clipboard = structuredClone(this.project.patterns[this.project.current]);
  }

  pastePattern() {
    const clip = this.clipboard;
    if (!clip) return;
    this.edit((p) => {
      p.patterns[p.current] = { ...structuredClone(clip), name: p.patterns[p.current].name };
    });
  }

  // --- sound / mixer: continuous controls, so no undo entry per drag tick ---

  setParam(track: number, key: keyof SoundParams, value: number) {
    this.edit((p) => { p.tracks[track].params[key] = value; }, false);
  }

  setMix(track: number, key: 'vol' | 'pan' | 'sendA' | 'sendB', value: number) {
    this.edit((p) => { p.tracks[track][key] = value; }, false);
  }

  setSample(track: number, id: string | null, name: string) {
    this.edit((p) => { p.tracks[track].sample = id; p.tracks[track].sampleName = name; });
  }

  setSlices(track: number, n: number) {
    this.edit((p) => { p.tracks[track].slices = n; });
  }

  // --- song chain ---

  songAdd(pattern: number) {
    this.edit((p) => { p.song.push({ pattern, repeats: 1 }); });
  }

  songRemove(i: number) {
    this.edit((p) => { p.song.splice(i, 1); });
  }

  songRepeats(i: number, repeats: number) {
    this.edit((p) => { if (p.song[i]) p.song[i].repeats = Math.min(16, Math.max(1, repeats)); });
  }

  songMove(i: number, dir: -1 | 1) {
    this.edit((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.song.length) return;
      [p.song[i], p.song[j]] = [p.song[j], p.song[i]];
    });
  }

  songClear() {
    this.edit((p) => { p.song = []; p.songMode = false; });
  }

  setSongMode(on: boolean) {
    this.edit((p) => { p.songMode = on && p.song.length > 0; }, false);
  }
}
