<script lang="ts">
  import { noteName } from '../notes';
  import type { Step, Track } from '../model';

  interface Props {
    tracks: Track[];
    steps: Step[][];
    playhead: number;
    onToggle: (track: number, step: number) => void;
    onEdit: (track: number, step: number) => void;
    onMute: (track: number) => void;
    onSolo: (track: number) => void;
  }
  let { tracks, steps, playhead, onToggle, onEdit, onMute, onSolo }: Props = $props();

  const LONG_PRESS_MS = 350;

  /**
   * One gesture on the grid:
   *  - quick tap            -> toggle that step (on release)
   *  - hold ~350 ms         -> open the step editor
   *  - press and drag over  -> paint the same state across the cells you cross
   * Rows never reflow while a finger is down, so a touch can't land on a shifted cell.
   */
  interface Gesture { t: number; s: number; timer: ReturnType<typeof setTimeout>; long: boolean; painting: boolean; paint: boolean }
  let g: Gesture | null = null;

  function down(e: PointerEvent, t: number, s: number) {
    // touch pointers are captured by the first cell; release so dragging reaches the others
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* no active pointer */ }
    const timer = setTimeout(() => {
      if (g && !g.painting) {
        g.long = true;
        navigator.vibrate?.(15);
        onEdit(g.t, g.s);
      }
    }, LONG_PRESS_MS);
    g = { t, s, timer, long: false, painting: false, paint: false };
  }

  function enter(t: number, s: number) {
    if (!g || g.long || (t === g.t && s === g.s)) return;
    clearTimeout(g.timer);
    if (!g.painting) {
      g.painting = true;
      g.paint = !steps[g.t][g.s].on;
      if (steps[g.t][g.s].on !== g.paint) onToggle(g.t, g.s);
    }
    if (steps[t][s].on !== g.paint) onToggle(t, s);
  }

  function end() {
    if (!g) return;
    clearTimeout(g.timer);
    if (!g.long && !g.painting) onToggle(g.t, g.s);
    g = null;
  }

  function cancel() {
    if (g) clearTimeout(g.timer);
    g = null;
  }

  // keyboard: Enter / Space toggles (a click with no pointer), Shift+Enter opens the editor
  function click(e: MouseEvent, t: number, s: number) {
    if (e.detail !== 0) return;
    if (e.shiftKey) onEdit(t, s);
    else onToggle(t, s);
  }

  const MELODIC = (k: Track['kind']) => k !== 'kick' && k !== 'snare' && k !== 'hat' && k !== 'sampler';

  function label(track: Track, step: Step): string {
    if (!step.on) return '';
    if (track.kind === 'sampler') return String((step.notes[0] ?? 0) + 1);
    if (MELODIC(track.kind) && step.notes.length) {
      return step.notes.length > 1 ? `${noteName(step.notes[0])}+` : noteName(step.notes[0]);
    }
    return '';
  }

  function describe(track: Track, step: Step, s: number): string {
    const bits = [`${track.name} крок ${s + 1}`];
    if (step.on) {
      bits.push('увімкнено');
      if (step.prob < 1) bits.push(`ймовірність ${Math.round(step.prob * 100)}%`);
      if (step.ratchet > 1) bits.push(`ратчет ${step.ratchet}`);
    }
    return bits.join(', ');
  }
</script>

<svelte:window onpointerup={end} onpointercancel={cancel} />

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
            class:chance={step.on && step.prob < 1}
            onpointerdown={(e) => down(e, t, s)}
            onpointerenter={() => enter(t, s)}
            onclick={(e) => click(e, t, s)}
            oncontextmenu={(e) => e.preventDefault()}
            aria-label={describe(track, step, s)}
            aria-pressed={step.on}
          >
            {label(track, step)}
            {#if step.on && step.ratchet > 1}<i class="rat">{step.ratchet}</i>{/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
  <p class="hint">Тап — увімкнути крок · потримай — змінити ноту і властивості</p>
</section>

<style>
  .grid { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 4px; display: flex; flex-direction: column; gap: 10px; }
  .row { display: flex; flex-direction: column; gap: 4px; }
  .head { display: flex; align-items: center; gap: 6px; }
  .label { flex: 1; font-size: 14px; color: var(--dim); }
  .m, .s { min-width: 44px; font-size: 14px; }
  .m.active { background: #5a2323; border-color: #a33; }
  .s.active { background: var(--accent); color: #000; border-color: var(--accent); }
  .hint { margin: 0; padding: 0 4px 2px; font-size: 13px; color: var(--dim); }
  /* 2 rows of 8 on phones, one row of 16 on wide screens */
  .cells { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; touch-action: none; }
  .cell {
    position: relative; min-width: 0; min-height: 44px; padding: 0; border-radius: 8px; background: var(--panel-2);
    touch-action: none; font-size: 13px; color: #000; font-weight: 600;
    -webkit-touch-callout: none; user-select: none;
  }
  .cell.beat { background: #26262c; }
  .cell.on { background: var(--hit); border-color: var(--hit); }
  .cell.chance { border-style: dashed; border-color: #666; background: #b9b9bf; }
  .cell.play { outline: 2px solid var(--accent); outline-offset: -2px; }
  .cell.play.on { background: var(--accent); border-color: var(--accent); }
  .rat { position: absolute; right: 3px; bottom: 1px; font-style: normal; font-size: 13px; font-weight: 700; line-height: 1; color: #000; opacity: .7; }
  /* 8 cells can't be 44px wide below ~385px: go 4 x 4 */
  @media (max-width: 384px) { .cells { grid-template-columns: repeat(4, 1fr); } }
  @media (min-width: 760px) { .cells { grid-template-columns: repeat(16, 1fr); } }
</style>
