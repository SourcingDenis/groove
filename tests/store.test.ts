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
