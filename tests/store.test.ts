import { describe, expect, it } from 'vitest';
import { Store } from '../src/store/store';

describe('Store', () => {
  it('toggles a step and undoes/redoes it', () => {
    const s = new Store();
    const before = s.get().patterns[0].steps[2][1].on;
    s.toggleStep(2, 1);
    expect(s.get().patterns[0].steps[2][1].on).toBe(!before);
    s.undo();
    expect(s.get().patterns[0].steps[2][1].on).toBe(before);
    s.redo();
    expect(s.get().patterns[0].steps[2][1].on).toBe(!before);
  });

  it('gives bass steps a default note', () => {
    const s = new Store();
    s.toggleStep(3, 1);
    expect(s.get().patterns[0].steps[3][1].notes.length).toBe(1);
  });

  it('does not record bpm / mute in undo history', () => {
    const s = new Store();
    s.setBpm(140);
    s.toggleMute(0);
    expect(s.canUndo).toBe(false);
  });

  it('clamps bpm', () => {
    const s = new Store();
    s.setBpm(9999);
    expect(s.get().bpm).toBe(300);
    s.setBpm(1);
    expect(s.get().bpm).toBe(30);
  });

  it('copies and pastes a pattern but keeps the target name', () => {
    const s = new Store();
    s.copyPattern();
    s.selectPattern(4);
    s.pastePattern();
    const p = s.get();
    expect(p.patterns[4].steps).toEqual(p.patterns[0].steps);
    expect(p.patterns[4].name).toBe('Lift');
  });

  it('clears a pattern', () => {
    const s = new Store();
    s.clearPattern();
    expect(s.get().patterns[0].steps.flat().some((x) => x.on)).toBe(false);
  });

  it('does not mutate earlier snapshots', () => {
    const s = new Store();
    const snap = s.get();
    s.toggleStep(0, 1);
    expect(snap.patterns[0].steps[0][1].on).toBe(false);
  });
});

describe('Store: sound, sampler, song', () => {
  it('places the chosen slice when a sampler step is switched on', () => {
    const s = new Store();
    s.toggleStep(7, 2, 5);
    expect(s.get().patterns[0].steps[7][2]).toMatchObject({ on: true, notes: [5] });
  });

  it('edits params and mix without undo entries', () => {
    const s = new Store();
    s.setParam(0, 'tune', 3);
    s.setMix(1, 'sendB', 0.7);
    expect(s.get().tracks[0].params.tune).toBe(3);
    expect(s.get().tracks[1].sendB).toBe(0.7);
    expect(s.canUndo).toBe(false);
  });

  it('builds, reorders and clears a song', () => {
    const s = new Store();
    s.songAdd(0); s.songAdd(2); s.songRepeats(1, 4);
    s.songMove(1, -1);
    expect(s.get().song).toEqual([{ pattern: 2, repeats: 4 }, { pattern: 0, repeats: 1 }]);
    s.songMove(0, -1); // out of range: no-op
    expect(s.get().song[0].pattern).toBe(2);
    s.setSongMode(true);
    expect(s.get().songMode).toBe(true);
    s.songClear();
    expect(s.get().song).toEqual([]);
    expect(s.get().songMode).toBe(false);
  });

  it('refuses song mode with an empty song and clamps repeats', () => {
    const s = new Store();
    s.setSongMode(true);
    expect(s.get().songMode).toBe(false);
    s.songAdd(0);
    s.songRepeats(0, 99);
    expect(s.get().song[0].repeats).toBe(16);
    s.songRepeats(0, 0);
    expect(s.get().song[0].repeats).toBe(1);
  });
});

import { noteName } from '../src/notes';

describe('Store: step properties', () => {
  it('sets step notes, switching the step on, and undoes in one go', () => {
    const s = new Store();
    s.setStepNotes(3, 1, [43]);
    expect(s.get().patterns[0].steps[3][1]).toMatchObject({ on: true, notes: [43] });
    s.undo();
    expect(s.get().patterns[0].steps[3][1].on).toBe(false);
  });

  it('keeps chord notes sorted', () => {
    const s = new Store();
    s.setStepNotes(3, 1, [67, 60, 64]);
    expect(s.get().patterns[0].steps[3][1].notes).toEqual([60, 64, 67]);
  });

  it('a switched-on step repeats the last notes you picked for that track', () => {
    const s = new Store();
    s.setStepNotes(3, 5, [41]);
    s.toggleStep(3, 7);
    expect(s.get().patterns[0].steps[3][7].notes).toEqual([41]);
  });

  it('falls back to the default bass note', () => {
    const s = new Store();
    s.toggleStep(3, 7);
    expect(s.get().patterns[0].steps[3][7].notes).toEqual([36]);
  });

  it('merges a slider drag into one undo entry', () => {
    const s = new Store();
    s.toggleStep(0, 1);
    const before = s.get().patterns[0].steps[0][1].vel;
    for (const v of [0.8, 0.7, 0.6, 0.5]) s.setStep(0, 1, { vel: v });
    expect(s.get().patterns[0].steps[0][1].vel).toBe(0.5);
    s.undo(); // the whole drag
    expect(s.get().patterns[0].steps[0][1].vel).toBe(before);
    expect(s.get().patterns[0].steps[0][1].on).toBe(true); // the toggle is still its own entry
  });

  it('does not merge edits of different properties', () => {
    const s = new Store();
    s.setStep(0, 2, { vel: 0.5 });
    s.setStep(0, 2, { prob: 0.5 });
    s.undo();
    expect(s.get().patterns[0].steps[0][2].prob).toBe(1);
    expect(s.get().patterns[0].steps[0][2].vel).toBe(0.5);
  });

  it('resets a step completely', () => {
    const s = new Store();
    s.setStep(0, 0, { prob: 0.3, ratchet: 4 });
    s.resetStep(0, 0);
    expect(s.get().patterns[0].steps[0][0]).toEqual({ on: false, notes: [], vel: 0.9, prob: 1, ratchet: 1, nudge: 0 });
  });
});

describe('noteName', () => {
  it('names MIDI notes', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(36)).toBe('C2');
    expect(noteName(70)).toBe('A#4');
  });
});

import { chordNotes } from '../src/notes';
import { defaultProject } from '../src/model';

describe('instruments', () => {
  it('ships eight tracks and a pattern row for each', () => {
    const p = defaultProject();
    expect(p.tracks.map((t) => t.kind)).toEqual(['kick', 'snare', 'hat', 'bass', 'lead', 'chord', 'bell', 'sampler']);
    expect(p.patterns.every((pat) => pat.steps.length === 8)).toBe(true);
  });

  it('a new chord step gets a triad, a new lead step a single note', () => {
    const s = new Store();
    s.toggleStep(5, 3);
    s.toggleStep(4, 3);
    expect(s.get().patterns[0].steps[5][3].notes).toEqual([60, 64, 67]);
    expect(s.get().patterns[0].steps[4][3].notes).toEqual([60]);
  });

  it('sets an arp mode with undo', () => {
    const s = new Store();
    s.setArp(5, 'updown');
    expect(s.get().tracks[5].arp).toBe('updown');
    s.undo();
    expect(s.get().tracks[5].arp).toBe('off');
  });

  it('builds chords from a root', () => {
    expect(chordNotes(60, 'maj')).toEqual([60, 64, 67]);
    expect(chordNotes(57, 'm7')).toEqual([57, 60, 64, 67]);
    expect(chordNotes(60, 'sus4')).toEqual([60, 65, 67]);
  });
});
