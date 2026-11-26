<script lang="ts">
  /** Hold to apply, release to reset. x right = 1, y up = 1. */
  let { onChange }: { onChange: (x: number, y: number, active: boolean) => void } = $props();

  let el: HTMLDivElement;
  let pos = $state<{ x: number; y: number } | null>(null);

  function read(e: PointerEvent) {
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    pos = { x, y };
    onChange(x, y, true);
  }
  function down(e: PointerEvent) {
    el.setPointerCapture(e.pointerId);
    read(e);
  }
  function move(e: PointerEvent) {
    if (pos) read(e);
  }
  function up() {
    if (!pos) return;
    pos = null;
    onChange(0, 0, false);
  }
</script>

<div
  bind:this={el}
  class="pad"
  class:on={pos}
  role="application"
  aria-label="XY-пед ефектів"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onlostpointercapture={up}
>
  {#if pos}
    <i class="h" style:top={`${(1 - pos.y) * 100}%`}></i>
    <i class="v" style:left={`${pos.x * 100}%`}></i>
    <b style:left={`${pos.x * 100}%`} style:top={`${(1 - pos.y) * 100}%`}></b>
  {:else}
    <span>Тримай і веди пальцем</span>
  {/if}
</div>

<style>
  .pad { position: relative; width: 100%; aspect-ratio: 1.6; max-height: 320px; touch-action: none; background: #060607; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; display: grid; place-items: center; }
  .pad.on { border-color: var(--accent); }
  span { color: var(--dim); font-size: 14px; pointer-events: none; }
  i { position: absolute; background: rgba(224,179,65,.5); pointer-events: none; }
  .h { left: 0; right: 0; height: 1px; }
  .v { top: 0; bottom: 0; width: 1px; }
  b { position: absolute; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%; background: var(--accent); pointer-events: none; box-shadow: 0 0 24px rgba(224,179,65,.6); }
</style>
