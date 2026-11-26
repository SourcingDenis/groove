<script lang="ts">
  import type { Step, Track } from '../model';
  interface Props {
    tracks: Track[];
    steps: Step[][];
    playhead: number;
    onToggle: (track: number, step: number) => void;
    onMute: (track: number) => void;
    onSolo: (track: number) => void;
  }
  let { tracks, steps, playhead, onToggle, onMute, onSolo }: Props = $props();

  // Painting: press on a step and drag across others to set them to the same state.
  // Rows never reflow while a finger is down, so a touch can't land on a shifted cell.
  let paint: boolean | null = null;

  function down(e: PointerEvent, t: number, s: number) {
    const on = steps[t][s].on;
    paint = !on;
    onToggle(t, s);
    // touch pointers are captured by the first cell; release so dragging reaches the others
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* no active pointer */ }
  }
  function enter(t: number, s: number) {
    if (paint !== null && steps[t][s].on !== paint) onToggle(t, s);
  }
  function end() { paint = null; }
</script>

<svelte:window onpointerup={end} onpointercancel={end} />

<section class="grid">
  {#each tracks as track, t}
    <div class="row">
      <div class="head">
        <span class="label">{track.name}</span>
        <button class="m" class:active={track.muted} onclick={() => onMute(t)} aria-pressed={track.muted}>M</button>
        <button class="s" class:active={track.solo} onclick={() => onSolo(t)} aria-pressed={track.solo}>S</button>
      </div>
      <div class="cells">
        {#each steps[t] as step, s}
          <button
            class="cell"
            class:on={step.on}
            class:beat={s % 4 === 0}
            class:play={s === playhead}
            onpointerdown={(e) => down(e, t, s)}
            onpointerenter={() => enter(t, s)}
            aria-label={`${track.name} крок ${s + 1}`}
            aria-pressed={step.on}
          >{#if step.on && track.kind === 'sampler'}{(step.notes[0] ?? 0) + 1}{/if}</button>
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  .grid { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 4px; display: flex; flex-direction: column; gap: 10px; }
  .row { display: flex; flex-direction: column; gap: 4px; }
  .head { display: flex; align-items: center; gap: 6px; }
  .label { flex: 1; font-size: 14px; color: var(--dim); }
  .m, .s { min-width: 44px; font-size: 14px; }
  .m.active { background: #5a2323; border-color: #a33; }
  .s.active { background: var(--accent); color: #000; border-color: var(--accent); }
  /* 2 rows of 8 on phones, one row of 16 on wide screens */
  .cells { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; touch-action: none; }
  .cell { min-width: 0; min-height: 44px; padding: 0; border-radius: 8px; background: var(--panel-2); touch-action: none; }
  .cell.beat { background: #26262c; }
  .cell.on { background: var(--hit); border-color: var(--hit); }
  .cell.play { outline: 2px solid var(--accent); outline-offset: -2px; }
  .cell.play.on { background: var(--accent); border-color: var(--accent); }
  /* 8 cells can't be 44px wide below ~385px: go 4 x 4 */
  @media (max-width: 384px) { .cells { grid-template-columns: repeat(4, 1fr); } }
  @media (min-width: 760px) { .cells { grid-template-columns: repeat(16, 1fr); } }
  .cell { font-size: 13px; color: #000; font-weight: 600; }
</style>
