<script lang="ts">
  import { onMount } from 'svelte';
  import { CHORDS, chordNotes, isBlackKey, noteName, pitchClassName, type ChordType } from '../notes';
  import { isPoly, type Step, type Track } from '../model';
  import Slider from './Slider.svelte';

  interface Props {
    track: Track;
    stepIndex: number;
    step: Step;
    onPatch: (patch: Partial<Step>) => void;
    onNotes: (notes: number[]) => void;
    onClear: () => void;
    onPreview: (notes: number[]) => void;
    onClose: () => void;
  }
  let { track, stepIndex, step, onPatch, onNotes, onClear, onPreview, onClose }: Props = $props();

  const melodic = $derived(!['kick', 'snare', 'hat', 'sampler'].includes(track.kind));
  const poly = $derived(isPoly(track.kind));

  // octave being shown; starts at the step's own octave so you see what's there
  let octave = $state(2);
  onMount(() => {
    const first = step.notes[0];
    octave = first !== undefined ? Math.floor(first / 12) - 1 : track.kind === 'bass' ? 2 : 4;
    dialog.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  let dialog: HTMLDivElement;
  const base = $derived((octave + 1) * 12);
  const has = (midi: number) => step.notes.includes(midi);

  function press(pc: number) {
    const midi = base + pc;
    let next: number[];
    if (poly) next = has(midi) ? step.notes.filter((n) => n !== midi) : [...step.notes, midi];
    else next = [midi];
    onNotes(next);
    if (next.length) onPreview(poly ? [midi] : next);
  }

  function chord(type: ChordType) {
    const root = step.notes[0] ?? base;
    const notes = chordNotes(root, type);
    onNotes(notes);
    onPreview(notes);
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const nudgeFmt = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={`Крок ${stepIndex + 1}, ${track.name}`} bind:this={dialog}>
  <div class="top">
    <strong>{track.name} · крок {stepIndex + 1}</strong>
    <button class:sel={step.on} onclick={() => onPatch({ on: !step.on })} aria-pressed={step.on}>{step.on ? 'Увімк.' : 'Вимк.'}</button>
    <button onclick={onClose}>Готово</button>
  </div>

  {#if melodic}
    <div class="oct">
      <button onclick={() => (octave = Math.max(0, octave - 1))} disabled={octave <= 0} aria-label="Октава нижче">−</button>
      <span>Октава {octave}</span>
      <button onclick={() => (octave = Math.min(7, octave + 1))} disabled={octave >= 7} aria-label="Октава вище">+</button>
      <span class="notes">{step.notes.length ? step.notes.map(noteName).join(' ') : 'без ноти'}</span>
    </div>
    <div class="keys">
      {#each Array.from({ length: 12 }, (_, i) => i) as pc}
        <button class="key" class:black={isBlackKey(pc)} class:sel={has(base + pc)} onclick={() => press(pc)} aria-pressed={has(base + pc)}>
          {pitchClassName(pc)}
        </button>
      {/each}
    </div>
  {/if}

  {#if poly}
    <div class="chords">
      <span class="lbl">Акорд</span>
      {#each Object.entries(CHORDS) as [id, c]}
        <button onclick={() => chord(id as ChordType)}>{c.label}</button>
      {/each}
    </div>
  {/if}

  <Slider label="Гучність" value={step.vel} min={0.05} max={1} step={0.01} format={pct} onChange={(v) => onPatch({ vel: v })} />
  <Slider label="Ймовірність" value={step.prob} min={0} max={1} step={0.05} format={pct} onChange={(v) => onPatch({ prob: v })} />
  <Slider label="Зсув" value={step.nudge} min={-0.5} max={0.5} step={0.05} format={nudgeFmt} onChange={(v) => onPatch({ nudge: v })} />

  <div class="rat">
    <span class="lbl">Ратчет</span>
    {#each [1, 2, 3, 4] as n}
      <button class:sel={step.ratchet === n} onclick={() => onPatch({ ratchet: n })} aria-pressed={step.ratchet === n}>{n}×</button>
    {/each}
  </div>

  <button class="clear" onclick={() => { onClear(); onClose(); }}>Очистити крок</button>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.55); }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 21;
    max-width: 960px; margin: 0 auto; max-height: 85vh; overflow: auto;
    background: var(--panel); border: 1px solid var(--line); border-radius: 16px 16px 0 0;
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 6px;
  }
  .top { display: flex; align-items: center; gap: 6px; }
  .top strong { flex: 1; font-size: 15px; }
  .oct { display: flex; align-items: center; gap: 8px; }
  .oct span { font-size: 14px; }
  .notes { margin-left: auto; color: var(--accent); font-variant-numeric: tabular-nums; }
  .keys { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
  .key { min-width: 0; padding: 0; min-height: 48px; }
  .key.black { background: #0d0d10; }
  .sel, .key.black.sel { background: var(--hit); color: #000; border-color: var(--hit); }
  .chords { display: flex; align-items: center; gap: 4px; }
  .chords .lbl { flex: 1; font-size: 14px; color: var(--dim); }
  .chords button { padding: 0 8px; }
  .rat { display: flex; align-items: center; gap: 6px; min-height: 44px; }
  .rat .lbl { flex: 1; font-size: 14px; color: var(--dim); }
  .clear { margin-top: 4px; }
</style>
