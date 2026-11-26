<script lang="ts">
  import { onMount } from 'svelte';
  import type { Project } from '../model';
  import type { Engine } from '../engine/engine';
  import type { Store } from '../store/store';
  import Slider from './Slider.svelte';

  let { project, store, engine }: { project: Project; store: Store; engine: Engine } = $props();

  let levels = $state<number[]>([]);
  onMount(() => {
    metro = engine.metronome;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!document.hidden) levels = engine.levels();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  let metro = $state(false);
  const ms = (v: number) => `${Math.round(v * 1000)} мс`;
  const db = (v: number) => `${Math.round(v)} dB`;
  const pan = (v: number) => (Math.abs(v) < 0.05 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<section class="page">
  <div class="strip master">
    <div class="head">
      <span class="name">Майстер</span>
      <button class="clk" class:active={metro} onclick={() => { metro = !metro; engine.metronome = metro; }} aria-pressed={metro}>Метроном</button>
    </div>
    <Slider label="Свінг" value={project.swing} min={0} max={0.6} step={0.01} format={pct} onChange={(v) => store.setSwing(v)} />
    <Slider label="Сайдчейн: відпускання" value={project.duckRelease} min={0.05} max={0.5} step={0.01} format={ms} onChange={(v) => store.setDuckRelease(v)} />
  </div>

  {#each project.tracks as t, i}
    <div class="strip">
      <div class="head">
        <span class="name">{t.name}</span>
        <div class="meter" aria-hidden="true"><i style:width={`${(levels[i] ?? 0) * 100}%`}></i></div>
        <button class="m" class:active={t.muted} onclick={() => store.toggleMute(i)} aria-pressed={t.muted}>M</button>
        <button class="s" class:active={t.solo} onclick={() => store.toggleSolo(i)} aria-pressed={t.solo}>S</button>
      </div>
      <Slider label="Гучність" value={t.vol} min={-40} max={6} step={1} format={db} onChange={(v) => store.setMix(i, 'vol', v)} />
      <Slider label="Панорама" value={t.pan} min={-1} max={1} step={0.05} format={pan} onChange={(v) => store.setMix(i, 'pan', v)} />
      <Slider label="Дилей" value={t.sendA} min={0} max={1} step={0.01} format={pct} onChange={(v) => store.setMix(i, 'sendA', v)} />
      <Slider label="Ревер" value={t.sendB} min={0} max={1} step={0.01} format={pct} onChange={(v) => store.setMix(i, 'sendB', v)} />
      {#if t.kind !== 'kick'}
        <Slider label="Сайдчейн" value={t.duck} min={0} max={1} step={0.01} format={pct} onChange={(v) => store.setDuck(i, v)} />
      {/if}
    </div>
  {/each}
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 6px; }
  .strip { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 8px; }
  .head { display: flex; align-items: center; gap: 6px; }
  .name { font-weight: 600; min-width: 4.5em; }
  .meter { flex: 1; height: 10px; background: var(--panel-2); border-radius: 5px; overflow: hidden; }
  .meter i { display: block; height: 100%; background: var(--accent); }
  .clk { margin-left: auto; }
  .clk.active { background: var(--hit); color: #000; border-color: var(--hit); }
  .m.active { background: #5a2323; border-color: #a33; }
  .s.active { background: var(--accent); color: #000; border-color: var(--accent); }
</style>
