<script lang="ts">
  import { onMount } from 'svelte';
  let { bins, height = 120 }: { bins: () => Float32Array | null; height?: number } = $props();

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0;
    let h = 0;
    const smooth = new Float32Array(32);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const data = bins();
      for (let i = 0; i < smooth.length; i++) {
        let target = 0;
        if (data) {
          // two FFT bins per column, dB -> 0..1
          const db = Math.max(data[i * 2] ?? -100, data[i * 2 + 1] ?? -100);
          target = Math.min(1, Math.max(0, (db + 90) / 60));
        }
        smooth[i] += (target - smooth[i]) * (target > smooth[i] ? 0.5 : 0.12);
      }
      ctx.clearRect(0, 0, w, h);
      const cols = smooth.length;
      const rows = 9;
      const cw = w / cols;
      const rh = h / rows;
      const r = Math.max(1.2, Math.min(cw, rh) * 0.28);
      for (let c = 0; c < cols; c++) {
        const lit = smooth[c] * (rows / 2);
        for (let k = 0; k < rows; k++) {
          const dist = Math.abs(k - (rows - 1) / 2);
          const on = dist <= lit;
          ctx.globalAlpha = on ? 0.35 + 0.65 * (1 - dist / (rows / 2)) : 0.12;
          ctx.fillStyle = '#f2f2f4';
          ctx.beginPath();
          ctx.arc(c * cw + cw / 2, k * rh + rh / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  });
</script>

<canvas bind:this={canvas} style:height={`${height}px`} aria-hidden="true"></canvas>

<style>
  canvas { width: 100%; display: block; background: #060607; border: 1px solid var(--line); border-radius: 14px; }
</style>
