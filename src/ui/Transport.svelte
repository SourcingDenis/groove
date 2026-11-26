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
    <output aria-label="BPM">{bpm}</output>
    <button onclick={() => onBpm(bpm + 1)} aria-label="Швидше">+</button>
  </div>
  <button onclick={tap}>Tap</button>
  <span class="spacer"></span>
  <button onclick={onUndo} disabled={!canUndo} aria-label="Скасувати">↶</button>
  <button onclick={onRedo} disabled={!canRedo} aria-label="Повернути">↷</button>
</section>

<style>
  .bar { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 8px; }
  .play { width: 56px; min-height: 52px; font-size: 20px; }
  .play.on { background: var(--hit); color: #000; }
  .bpm { display: flex; align-items: center; gap: 4px; }
  output { min-width: 3ch; text-align: center; font-variant-numeric: tabular-nums; font-size: 18px; }
  .spacer { flex: 1; }
</style>
