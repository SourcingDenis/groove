<script lang="ts">
  import type { Pattern } from '../model';
  interface Props {
    patterns: Pattern[];
    current: number;
    playingPattern: number;
    queued: number | null;
    onPick: (i: number) => void;
    onCopy: () => void;
    onPaste: () => void;
    onClear: () => void;
  }
  let { patterns, current, playingPattern, queued, onPick, onCopy, onPaste, onClear }: Props = $props();

  const hasNotes = (p: Pattern) => p.steps.some((row) => row.some((s) => s.on));
</script>

<section class="panel">
  <div class="pads">
    {#each patterns as p, i}
      <button
        class="pad"
        class:sel={i === current}
        class:live={i === playingPattern}
        class:next={i === queued}
        onclick={() => onPick(i)}
        aria-pressed={i === current}
      >
        <span class="n">{i + 1}{#if hasNotes(p)}<i class="dot"></i>{/if}</span>
        <span class="name">{p.name}</span>
      </button>
    {/each}
  </div>
  <div class="tools">
    <button onclick={onCopy}>Копія</button>
    <button onclick={onPaste}>Вставити</button>
    <button onclick={onClear}>Очистити</button>
  </div>
</section>

<style>
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 4px; display: flex; flex-direction: column; gap: 6px; }
  .pads { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; }
  .pad { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px 0; min-width: 0; min-height: 52px; }
  .n { font-size: 16px; font-weight: 600; display: inline-flex; gap: 3px; align-items: flex-start; }
  .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--hit); display: inline-block; }
  .name { font-size: 13px; color: var(--dim); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; }
  .sel { background: var(--hit); color: #000; }
  .sel .name { color: #444; }
  .sel .dot { background: #000; }
  .live { border-color: var(--accent); box-shadow: inset 0 -3px 0 var(--accent); }
  .next { border-color: var(--accent); border-style: dashed; }
  .tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
</style>
