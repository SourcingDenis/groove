<script lang="ts">
  import type { Project } from '../model';
  import type { Engine, PerfMode } from '../engine/engine';
  import type { Store } from '../store/store';
  import PatternPads from './PatternPads.svelte';
  import Visualizer from './Visualizer.svelte';
  import XYPad from './XYPad.svelte';

  interface Props {
    project: Project;
    store: Store;
    engine: Engine;
    playingPattern: number;
    queued: number | null;
    onPick: (i: number) => void;
  }
  let { project, store, engine, playingPattern, queued, onPick }: Props = $props();

  const MODES: { id: PerfMode; label: string; hint: string }[] = [
    { id: 'filter', label: 'Фільтр', hint: '← закрити · відкрити →, вгору = резонанс' },
    { id: 'delay', label: 'Дилей', hint: 'вгору = скільки в дилей, вправо = повторів більше' },
    { id: 'reverb', label: 'Ревер', hint: 'вправо = більше ревера, вгору = світліше' },
  ];
  let mode = $state<PerfMode>('filter');
  let repeat = $state<number | null>(null);

  async function perf(x: number, y: number, active: boolean) {
    if (active) {
      await engine.ensureBuilt(); // first touch may come before Play
      engine.setPerf(mode, x, y);
    } else engine.setPerf(null, 0, 0);
  }

  function hold(steps: number | null) {
    repeat = steps;
    engine.setRepeat(steps);
  }
</script>

<section class="page">
  <Visualizer bins={() => engine.bins()} height={110} />

  <PatternPads
    patterns={project.patterns}
    current={project.current}
    {playingPattern}
    {queued}
    {onPick}
    tools={false}
  />

  <div class="panel">
    <div class="modes">
      {#each MODES as m}
        <button class:sel={mode === m.id} onclick={() => (mode = m.id)} aria-pressed={mode === m.id}>{m.label}</button>
      {/each}
    </div>
    <XYPad onChange={perf} />
    <p class="hint">{MODES.find((m) => m.id === mode)?.hint}</p>
  </div>

  <div class="panel">
    <span class="lbl">Повтор (тримай)</span>
    <div class="reps">
      {#each [[4, '1/4'], [2, '1/8'], [1, '1/16']] as [n, label]}
        <button
          class:sel={repeat === n}
          onpointerdown={() => hold(n as number)}
          onpointerup={() => hold(null)}
          onpointercancel={() => hold(null)}
          onpointerleave={() => repeat === n && hold(null)}
          oncontextmenu={(e) => e.preventDefault()}
        >{label}</button>
      {/each}
    </div>
  </div>

  <div class="panel">
    <span class="lbl">Мʼют / соло</span>
    <div class="mutes">
      {#each project.tracks as t, i}
        <div class="mute">
          <button class="big" class:muted={t.muted} onclick={() => store.toggleMute(i)} aria-pressed={t.muted}>{t.name}</button>
          <button class="solo" class:active={t.solo} onclick={() => store.toggleSolo(i)} aria-pressed={t.solo} aria-label={`Соло ${t.name}`}>S</button>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 6px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
  .modes, .reps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .reps button { min-height: 56px; touch-action: none; user-select: none; }
  .lbl { font-size: 14px; color: var(--dim); }
  .hint { margin: 0; font-size: 13px; color: var(--dim); }
  .sel { background: var(--hit); color: #000; border-color: var(--hit); }
  .mutes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .mute { display: grid; grid-template-columns: 1fr 44px; gap: 4px; }
  .big { min-height: 52px; }
  .big.muted { background: #5a2323; border-color: #a33; text-decoration: line-through; }
  .solo.active { background: var(--accent); color: #000; border-color: var(--accent); }
</style>
