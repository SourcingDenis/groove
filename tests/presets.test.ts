import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET, defaultProject, type TrackKind } from '../src/model';
import { getPreset, KITS, PRESETS, presetParams, type UserPreset } from '../src/presets';
import { deleteUserPreset, listUserPresets, saveUserPreset } from '../src/store/persist';
import { Store } from '../src/store/store';

const KINDS = Object.keys(PRESETS) as TrackKind[];

describe('preset catalogue', () => {
  it('has presets for every kind, with unique ids and a config of the matching kind', () => {
    for (const kind of KINDS) {
      expect(PRESETS[kind].length).toBeGreaterThan(0);
      expect(new Set(PRESETS[kind].map((p) => p.id)).size).toBe(PRESETS[kind].length);
      for (const p of PRESETS[kind]) expect(p.config.kind).toBe(kind);
    }
  });

  it('every default preset exists, and a new project uses them', () => {
    for (const kind of KINDS) expect(PRESETS[kind].some((p) => p.id === DEFAULT_PRESET[kind])).toBe(true);
    for (const t of defaultProject().tracks) expect(t.preset).toBe(DEFAULT_PRESET[t.kind]);
  });

  it('every kit id exists for kick, snare and hat', () => {
    for (const kit of KITS) for (const kind of ['kick', 'snare', 'hat'] as const) {
      expect(PRESETS[kind].some((p) => p.id === kit.id)).toBe(true);
    }
  });

  it('falls back to the first preset for an unknown id', () => {
    expect(getPreset('bass', 'nope')).toBe(PRESETS.bass[0]);
  });

  it('applies a preset’s macro overrides on top of the defaults', () => {
    expect(presetParams(getPreset('kick', 'lofi'))).toEqual({ tune: 0, decay: 0.5, tone: 0.6 });
    expect(presetParams(getPreset('kick', '909'))).toEqual({ tune: 0, decay: 0.5, tone: 1 });
  });
});

describe('Store presets', () => {
  it('switches a track preset and resets its macros', () => {
    const s = new Store();
    s.setParam(3, 'tone', 0.2);
    s.setPreset(3, 'acid');
    expect(s.get().tracks[3]).toMatchObject({ preset: 'acid', params: { tune: 0, decay: 0.5, tone: 1 } });
    s.undo();
    expect(s.get().tracks[3].preset).toBe('saw');
  });

  it('applies a kit to kick, snare and hat only, in one undo step', () => {
    const s = new Store();
    s.applyKit('lofi');
    const t = s.get().tracks;
    expect(t.filter((x) => x.preset === 'lofi').map((x) => x.kind)).toEqual(['kick', 'snare', 'hat']);
    expect(t[0].params.tone).toBe(0.6);
    expect(t[3].preset).toBe('saw'); // bass untouched
    s.undo();
    expect(s.get().tracks[0].preset).toBe('909');
  });

  it('ignores an unknown kit', () => {
    const s = new Store();
    s.applyKit('nope');
    expect(s.canUndo).toBe(false);
  });

  it('applies a saved sound only to a track of the same kind', () => {
    const s = new Store();
    const sound = { kind: 'bass' as const, preset: 'reese', params: { tune: -5, decay: 0.7, tone: 0.4 }, arp: 'off' };
    s.applySound(0, sound); // kick: refused
    expect(s.get().tracks[0].preset).toBe('909');
    s.applySound(3, sound);
    expect(s.get().tracks[3]).toMatchObject({ preset: 'reese', params: { tune: -5, decay: 0.7, tone: 0.4 } });
  });

  it('restores the arp mode from a saved chord sound', () => {
    const s = new Store();
    s.applySound(5, { kind: 'chord', preset: 'keys', params: { tune: 0, decay: 0.5, tone: 1 }, arp: 'updown' });
    expect(s.get().tracks[5]).toMatchObject({ preset: 'keys', arp: 'updown' });
  });
});

describe('user presets in IndexedDB', () => {
  const mk = (id: string, name: string): UserPreset => ({ id, kind: 'bass', name, preset: 'sub', params: { tune: 0, decay: 0.5, tone: 1 }, arp: 'off' });

  it('saves, lists alphabetically and deletes', async () => {
    await saveUserPreset(mk('b', 'Wobble'));
    await saveUserPreset(mk('a', 'Deep'));
    expect((await listUserPresets()).map((p) => p.name)).toEqual(['Deep', 'Wobble']);
    await deleteUserPreset('a');
    expect((await listUserPresets()).map((p) => p.name)).toEqual(['Wobble']);
  });

  it('overwrites a preset saved under the same id', async () => {
    await saveUserPreset(mk('b', 'Renamed'));
    const list = await listUserPresets();
    expect(list.filter((p) => p.id === 'b')).toHaveLength(1);
    expect(list.find((p) => p.id === 'b')!.name).toBe('Renamed');
  });
});
