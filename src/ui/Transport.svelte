<script lang="ts">
  interface Props {
    playing: boolean;
    bpm: number;
    canUndo: boolean;
    canRedo: boolean;
    onToggle: () => void;
    onBpm: (bpm: number) => void;
    onUndo: () => void;
    onRedo: () => void;
  }
  let { playing, bpm, canUndo, canRedo, onToggle, onBpm, onUndo, onRedo }: Props = $props();

  let editing = $state(false);
  // a type=number input binds as a number once it holds a valid value, so accept both
  let draft = $state<string | number>('');
  let input: HTMLInputElement | undefined = $state();

  function startEdit() {
    draft = String(bpm);
    editing = true;
    queueMicrotask(() => { input?.focus(); input?.select(); });
  }
  function commit() {
    if (!editing) return;
    editing = false;
    const n = parseFloat(String(draft).replace(',', '.'));
    if (Number.isFinite(n)) onBpm(n);
  }
  function keydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') editing = false;
  }

  // tap tempo: average of the last few taps, reset after a 2 s pause
  let taps: number[] = [];
  function tap() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now);
    taps = taps.slice(-5);
    if (taps.length >= 2) {
      const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      onBpm(60000 / avg);
    }
  }
</script>

<section class="bar">
  <button class="play" class:on={playing} onclick={onToggle} aria-label={playing ? 'Стоп' : 'Грати'}>
    {playing ? '■' : '▶'}
  </button>
  <div class="bpm">
    <button onclick={() => onBpm(bpm - 1)} aria-label="Повільніше">−</button>
    {#if editing}
      <input bind:this={input} bind:value={draft} class="bpm-in" type="number" inputmode="decimal" min="30" max="300" aria-label="BPM" onblur={commit} onkeydown={keydown} />
    {:else}
      <button class="bpm-num" onclick={startEdit} aria-label={`BPM ${bpm}, натисни щоб ввести`}>{bpm}</button>
    {/if}
    <button onclick={() => onBpm(bpm + 1)} aria-label="Швидше">+</button>
  </div>
  <button onclick={tap}>Tap</button>
  <span class="spacer"></span>
  <button onclick={onUndo} disabled={!canUndo} aria-label="Скасувати">↶</button>
  <button onclick={onRedo} disabled={!canRedo} aria-label="Повернути">↷</button>
</section>

<style>
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; position: sticky; top: 0; z-index: 5; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 8px; }
  .play { width: 56px; min-height: 52px; font-size: 20px; }
  .play.on { background: var(--hit); color: #000; }
  .bpm { display: flex; align-items: center; gap: 4px; }
  .bpm-num { min-width: 3.4em; font-size: 18px; font-variant-numeric: tabular-nums; background: transparent; border-color: transparent; }
  .bpm-in { width: 4.6em; min-height: 44px; font: inherit; font-size: 18px; text-align: center; color: var(--text); background: var(--panel-2); border: 1px solid var(--accent); border-radius: 10px; user-select: text; -webkit-user-select: text; }
  .spacer { flex: 1; }
</style>
