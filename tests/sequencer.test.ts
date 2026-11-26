import { describe, expect, it } from 'vitest';
import { defaultProject } from '../src/model';
import { audibleTracks, resolvePattern, triggersAt } from '../src/engine/sequencer';

describe('triggersAt', () => {
  it('fires kick on the downbeat of the seeded pattern', () => {
    const p = defaultProject();
    const t = triggersAt(p, 0, 0);
    expect(t.map((x) => x.track)).toContain(0);
  });

  it('is silent on an empty pattern', () => {
    const p = defaultProject();
    for (let s = 0; s < 16; s++) expect(triggersAt(p, 5, s)).toEqual([]);
  });

  it('wraps the step index by pattern length', () => {
    const p = defaultProject();
    expect(triggersAt(p, 0, 16)).toEqual(triggersAt(p, 0, 0));
  });

  it('respects mute', () => {
    const p = defaultProject();
    p.tracks[0].muted = true;
    expect(triggersAt(p, 0, 0).map((x) => x.track)).not.toContain(0);
  });

  it('solo wins over mute state of other tracks', () => {
    const p = defaultProject();
    p.tracks[2].solo = true;
    expect(audibleTracks(p)).toEqual([false, false, true, false, false, false, false, false]);
    expect(triggersAt(p, 0, 0).every((x) => x.track === 2)).toBe(true);
  });

  it('returns nothing for a missing pattern', () => {
    expect(triggersAt(defaultProject(), 99, 0)).toEqual([]);
  });
});

describe('resolvePattern', () => {
  it('switches only on step 0', () => {
    expect(resolvePattern(0, 3, 5)).toBe(0);
    expect(resolvePattern(0, 3, 0)).toBe(3);
  });
  it('keeps the current pattern with nothing queued', () => {
    expect(resolvePattern(2, null, 0)).toBe(2);
  });
});

import { advanceSong, songSteps } from '../src/engine/sequencer';

describe('advanceSong', () => {
  const song = [{ pattern: 0, repeats: 2 }, { pattern: 3, repeats: 1 }];
  it('repeats an entry before moving on', () => {
    expect(advanceSong(song, 0, 0)).toEqual({ idx: 0, rep: 1 });
    expect(advanceSong(song, 0, 1)).toEqual({ idx: 1, rep: 0 });
  });
  it('wraps to the first entry', () => {
    expect(advanceSong(song, 1, 0)).toEqual({ idx: 0, rep: 0 });
  });
  it('handles an empty song', () => {
    expect(advanceSong([], 0, 0)).toEqual({ idx: 0, rep: 0 });
  });
  it('treats repeats below 1 as 1', () => {
    expect(advanceSong([{ pattern: 0, repeats: 0 }, { pattern: 1, repeats: 1 }], 0, 0)).toEqual({ idx: 1, rep: 0 });
  });
});

describe('songSteps', () => {
  it('sums pattern length x repeats', () => {
    const p = defaultProject();
    p.song = [{ pattern: 0, repeats: 2 }, { pattern: 1, repeats: 3 }];
    expect(songSteps(p)).toBe(16 * 2 + 16 * 3);
  });
});

import { expandHits, RATCHET_DECAY, type Trigger } from '../src/engine/sequencer';

const trig = (over: Partial<Trigger> = {}): Trigger => ({ track: 0, notes: [36], vel: 1, prob: 1, ratchet: 1, nudge: 0, ...over });
const STEP = 0.125;

describe('expandHits', () => {
  it('plays one hit on the step by default', () => {
    expect(expandHits(trig(), STEP, () => 0.99)).toEqual([{ offset: 0, vel: 1, notes: [36] }]);
  });

  it('prob 1 always plays, prob 0 never does', () => {
    expect(expandHits(trig({ prob: 1 }), STEP, () => 0.999999)).toHaveLength(1);
    expect(expandHits(trig({ prob: 0 }), STEP, () => 0)).toHaveLength(0);
  });

  it('plays when the roll is under prob and skips when it is over', () => {
    expect(expandHits(trig({ prob: 0.5 }), STEP, () => 0.49)).toHaveLength(1);
    expect(expandHits(trig({ prob: 0.5 }), STEP, () => 0.5)).toHaveLength(0);
  });

  it('splits the step evenly for a ratchet and softens each hit', () => {
    const hits = expandHits(trig({ ratchet: 4 }), STEP, () => 0);
    expect(hits.map((h) => h.offset)).toEqual([0, STEP / 4, (2 * STEP) / 4, (3 * STEP) / 4]);
    expect(hits[1].vel).toBeCloseTo(RATCHET_DECAY);
    expect(hits[3].vel).toBeCloseTo(RATCHET_DECAY ** 3);
  });

  it('shifts every hit by the nudge, forwards or backwards', () => {
    expect(expandHits(trig({ nudge: 0.5 }), STEP, () => 0)[0].offset).toBeCloseTo(STEP / 2);
    expect(expandHits(trig({ nudge: -0.25, ratchet: 2 }), STEP, () => 0).map((h) => h.offset)).toEqual([-STEP / 4, STEP / 2 - STEP / 4]);
  });

  it('clamps out-of-range values', () => {
    expect(expandHits(trig({ ratchet: 9 }), STEP, () => 0)).toHaveLength(4);
    expect(expandHits(trig({ ratchet: 0 }), STEP, () => 0)).toHaveLength(1);
    expect(expandHits(trig({ nudge: 5 }), STEP, () => 0)[0].offset).toBeCloseTo(STEP / 2);
  });
});

describe('triggersAt carries step properties', () => {
  it('passes prob / ratchet / nudge through', () => {
    const p = defaultProject();
    Object.assign(p.patterns[0].steps[0][0], { prob: 0.4, ratchet: 3, nudge: -0.1 });
    expect(triggersAt(p, 0, 0).find((t) => t.track === 0)).toMatchObject({ prob: 0.4, ratchet: 3, nudge: -0.1 });
  });
});

import { arpNote } from '../src/engine/sequencer';

describe('arpNote', () => {
  const chord = [60, 64, 67];
  const run = (mode: Parameters<typeof arpNote>[1], n = 8) => Array.from({ length: n }, (_, i) => arpNote(chord, mode, i, () => 0));
  it('up cycles low to high', () => expect(run('up', 7)).toEqual([60, 64, 67, 60, 64, 67, 60]));
  it('down cycles high to low', () => expect(run('down', 4)).toEqual([67, 64, 60, 67]));
  it('updown bounces without repeating the ends', () => expect(run('updown', 8)).toEqual([60, 64, 67, 64, 60, 64, 67, 64]));
  it('random picks through the rng', () => {
    expect(arpNote(chord, 'random', 0, () => 0)).toBe(60);
    expect(arpNote(chord, 'random', 0, () => 0.99)).toBe(67);
  });
  it('plays a single note as it is', () => expect(arpNote([50], 'updown', 3)).toBe(50));
  it('handles two notes in updown', () => {
    expect([0, 1, 2, 3].map((i) => arpNote([60, 67], 'updown', i))).toEqual([60, 67, 60, 67]);
  });
});

describe('expandHits with an arpeggiator', () => {
  const chordTrig = (over: Partial<Trigger> = {}): Trigger => ({ track: 5, notes: [60, 64, 67], vel: 1, prob: 1, ratchet: 1, nudge: 0, ...over });
  it('plays one chord note per step, advancing with the step index', () => {
    const notesAt = (stepIndex: number) => expandHits(chordTrig(), STEP, () => 0, { mode: 'up', stepIndex })[0].notes;
    expect([0, 1, 2, 3].map(notesAt)).toEqual([[60], [64], [67], [60]]);
  });
  it('a ratchet runs the arp faster inside the step', () => {
    const hits = expandHits(chordTrig({ ratchet: 2 }), STEP, () => 0, { mode: 'up', stepIndex: 1 });
    expect(hits.map((h) => h.notes[0])).toEqual([67, 60]); // sub-steps 2 and 3
  });
  it('leaves the full chord alone when the arp is off', () => {
    expect(expandHits(chordTrig(), STEP, () => 0, { mode: 'off', stepIndex: 0 })[0].notes).toEqual([60, 64, 67]);
  });
  it('does nothing to a single-note step', () => {
    expect(expandHits(chordTrig({ notes: [60] }), STEP, () => 0, { mode: 'up', stepIndex: 2 })[0].notes).toEqual([60]);
  });
});
