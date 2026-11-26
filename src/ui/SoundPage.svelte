<script lang="ts">
  import { ARP_MODES, hasArp, MACROS, type Project } from '../model';
  import type { Engine } from '../engine/engine';
  import type { Store } from '../store/store';
  import Slider from './Slider.svelte';
  import SamplerPanel from './SamplerPanel.svelte';

  interface Props {
    project: Project;
    store: Store;
    engine: Engine;
    selected: number;
    onSelect: (i: number) => void;
    activeSlice: number;
    sampleVersion: number;
    onSlice: (n: number) => void;
    onLoaded: () => void;
  }
  let { project, store, engine, selected, onSelect, activeSlice, sampleVersion, onSlice, onLoaded }: Props = $props();

  const track = $derived(project.tracks[selected]);
  const fmt = (key: string) => (v: number) =>
    key === 'tune' ? `${v > 0 ? '+' : ''}${Math.round(v)} st` : `${Math.round(v * 100)}%`;
</script>

<section class="page">
  <div class="chips">
    {#each project.tracks as t, i}
      <button class:sel={i === selected} onclick={() => onSelect(i)} aria-pressed={i === selected}>{t.name}</button>
    {/each}
  </div>

  {#each MACROS[track.kind] as m (m.key)}
    <Slider
      label={m.label}
      value={track.params[m.key]}
      min={m.min}
      max={m.max}
      step={m.step}
      format={fmt(m.key)}
      onChange={(v) => store.setParam(selected, m.key, v)}
    />
  {/each}

  {#if hasArp(track.kind)}
    <div class="arp">
      <span class="lbl">Арпеджіатор</span>
      <div class="modes">
        {#each ARP_MODES as m}
          <button class:sel={track.arp === m.id} onclick={() => store.setArp(selected, m.id)} aria-pressed={track.arp === m.id}>{m.label}</button>
        {/each}
      </div>
      <p class="hint">Грає по одній ноті акорда на кожен крок: постав акорд на ряд кроків — вийде арпеджіо.</p>
    </div>
  {/if}

  {#if track.kind === 'sampler'}
    <SamplerPanel {track} index={selected} {store} {engine} {activeSlice} {sampleVersion} {onSlice} {onLoaded} />
  {/if}
</section>

<style>
  .page { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chips button { flex: 1; min-width: 56px; }
  .arp { display: flex; flex-direction: column; gap: 6px; }
  .modes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
  .modes button { min-width: 0; padding: 0; font-size: 13px; }
  .lbl { font-size: 14px; color: var(--dim); }
  .hint { margin: 0; font-size: 13px; color: var(--dim); }
  .sel { background: var(--hit); color: #000; border-color: var(--hit); }
</style>
