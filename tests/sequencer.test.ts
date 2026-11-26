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
    expect(audibleTracks(p)).toEqual([false, false, true, false, false]);
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
