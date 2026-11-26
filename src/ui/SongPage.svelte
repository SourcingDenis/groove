<script lang="ts">
  import type { Project } from '../model';
  import { songSteps } from '../engine/sequencer';
  import type { Store } from '../store/store';

  interface Props {
    project: Project;
    store: Store;
    songIndex: number;
  }
  let { project, store, songIndex }: Props = $props();

  const bars = $derived(Math.round((songSteps(project) / 16) * 10) / 10);
</script>

<section class="page">
  <div class="top">
    <button class:sel={project.songMode} disabled={project.song.length === 0} onclick={() => store.setSongMode(!project.songMode)} aria-pressed={project.songMode}>
      {project.songMode ? 'Пісня: увімк.' : 'Пісня: вимк.'}
    </button>
    <span class="dim">{project.song.length ? `${bars} тактів` : 'ланцюжок порожній'}</span>
  </div>

  <ol>
    {#each project.song as e, i}
      <li class:now={i === songIndex}>
        <span class="n">{i + 1}</span>
        <span class="pname">{e.pattern + 1} · {project.patterns[e.pattern]?.name}</span>
        <div class="rep">
          <button onclick={() => store.songRepeats(i, e.repeats - 1)} aria-label="Менше повторів">−</button>
          <output>×{e.repeats}</output>
          <button onclick={() => store.songRepeats(i, e.repeats + 1)} aria-label="Більше повторів">+</button>
        </div>
        <button onclick={() => store.songMove(i, -1)} disabled={i === 0} aria-label="Вгору">↑</button>
        <button onclick={() => store.songMove(i, 1)} disabled={i === project.song.length - 1} aria-label="Вниз">↓</button>
        <button onclick={() => store.songRemove(i)} aria-label="Видалити">✕</button>
      </li>
    {/each}
  </ol>

  <div class="add">
    <button onclick={() => store.songAdd(project.current)}>+ Додати патерн {project.current + 1} · {project.patterns[project.current].name}</button>
    <button onclick={() => store.songClear()} disabled={project.song.length === 0}>Очистити</button>
  </div>
  <p class="hint">Вибери патерн на вкладці «Кроки» і додай його в ланцюжок. Під час гри «Пісня» сама перемикає патерни по тактах.</p>
</section>

<style>
  .page { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
  .top { display: flex; align-items: center; gap: 10px; }
  .dim, .hint { color: var(--dim); font-size: 13px; margin: 0; }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  li { display: flex; align-items: center; gap: 4px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 2px 4px; }
  li.now { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
  .n { width: 1.6em; text-align: center; color: var(--dim); font-size: 14px; }
  .pname { flex: 1; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rep { display: flex; align-items: center; }
  output { min-width: 2.4em; text-align: center; font-variant-numeric: tabular-nums; }
  li button { padding: 0; }
  .add { display: flex; flex-direction: column; gap: 6px; }
  .sel { background: var(--hit); color: #000; border-color: var(--hit); }
</style>
