<script lang="ts">
  import { ARP_MODES, hasArp, MACROS, type Project } from '../model';
  import { KITS, PRESETS, type UserPreset } from '../presets';
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
    userPresets: UserPreset[];
    onSaveUser: (name: string) => void;
    onDeleteUser: (id: string) => void;
  }
  let { project, store, engine, selected, onSelect, activeSlice, sampleVersion, onSlice, onLoaded, userPresets, onSaveUser, onDeleteUser }: Props = $props();

  const track = $derived(project.tracks[selected]);
  const isDrum = $derived(['kick', 'snare', 'hat'].includes(track.kind));
  const mine = $derived(userPresets.filter((u) => u.kind === track.kind));
  const builtIn = $derived(PRESETS[track.kind]);
  // a drum kit is "active" when all three drum tracks sit on the same preset id
  const activeKit = $derived.by(() => {
    const ids = project.tracks.filter((t) => ['kick', 'snare', 'hat'].includes(t.kind)).map((t) => t.preset);
    return ids.length && ids.every((i) => i === ids[0]) ? ids[0] : '';
  });

  let naming = $state(false);
  let name = $state('');
  function startSave() {
    name = `${track.name} ${mine.length + 1}`;
    naming = true;
  }
  function save() {
    const n = name.trim();
    if (!n) return;
    onSaveUser(n);
    naming = false;
  }

  const fmt = (key: string) => (v: number) =>
    key === 'tune' ? `${v > 0 ? '+' : ''}${Math.round(v)} st` : `${Math.round(v * 100)}%`;
</script>

<section class="page">
  <div class="chips">
    {#each project.tracks as t, i}
      <button class:sel={i === selected} onclick={() => onSelect(i)} aria-pressed={i === selected}>{t.name}</button>
    {/each}
  </div>

  {#if isDrum}
    <div class="group">
      <span class="lbl">Кіт (усі ударні)</span>
      <div class="opts">
        {#each KITS as k}
          <button class:sel={activeKit === k.id} onclick={() => store.applyKit(k.id)} aria-pressed={activeKit === k.id}>{k.name}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#if builtIn.length > 1}
    <div class="group">
      <span class="lbl">Пресет · {track.name}</span>
      <div class="opts">
        {#each builtIn as pr}
          <button class:sel={track.preset === pr.id} onclick={() => store.setPreset(selected, pr.id)} aria-pressed={track.preset === pr.id}>{pr.name}</button>
        {/each}
      </div>
    </div>
  {/if}

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

  {#if track.kind !== 'sampler'}
    <div class="group">
      <span class="lbl">Мої пресети · {track.name}</span>
      {#each mine as u (u.id)}
        <div class="user">
          <button class="apply" onclick={() => store.applySound(selected, u)}>{u.name}</button>
          <button onclick={() => onDeleteUser(u.id)} aria-label={`Видалити ${u.name}`}>✕</button>
        </div>
      {/each}
      {#if naming}
        <form class="save" onsubmit={(e) => { e.preventDefault(); save(); }}>
          <input bind:value={name} maxlength="24" aria-label="Назва пресета" />
          <button type="submit">Зберегти</button>
          <button type="button" onclick={() => (naming = false)}>Скасувати</button>
        </form>
      {:else}
        <button onclick={startSave}>+ Зберегти поточний звук</button>
      {/if}
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
  .group { display: flex; flex-direction: column; gap: 6px; }
  .opts { display: flex; flex-wrap: wrap; gap: 4px; }
  .opts button { flex: 1; min-width: 64px; }
  .user { display: grid; grid-template-columns: 1fr 44px; gap: 4px; }
  .apply { text-align: left; }
  .save { display: grid; grid-template-columns: 1fr auto auto; gap: 4px; }
  .save input { min-width: 0; min-height: 44px; font: inherit; color: var(--text); background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; user-select: text; -webkit-user-select: text; }
  .sel { background: var(--hit); color: #000; border-color: var(--hit); }
</style>
