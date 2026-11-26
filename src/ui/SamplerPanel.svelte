<script lang="ts">
  import { SLICE_OPTIONS, type Track } from '../model';
  import type { Engine } from '../engine/engine';
  import { getSample, newId, peaks, registerSample, startMic } from '../engine/samples';
  import type { Store } from '../store/store';
  import { saveSample } from '../store/persist';

  interface Props {
    track: Track;
    index: number;
    store: Store;
    engine: Engine;
    activeSlice: number;
    /** bumps when a sample finishes decoding, so the waveform redraws */
    sampleVersion: number;
    onSlice: (n: number) => void;
    onLoaded: () => void;
  }
  let { track, index, store, engine, activeSlice, sampleVersion, onSlice, onLoaded }: Props = $props();

  let canvas: HTMLCanvasElement;
  let error = $state('');
  let recording = $state(false);
  let busy = $state(false);
  let mic: { stop: () => Promise<Blob> } | null = null;

  async function adopt(blob: Blob, name: string) {
    busy = true;
    error = '';
    try {
      const id = newId();
      await registerSample(id, blob); // decode first: a bad file must not replace a good sample
      await saveSample(id, blob);
      store.setSample(index, id, name);
      onLoaded();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Не вдалося прочитати аудіо';
    } finally {
      busy = false;
    }
  }

  async function pick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await adopt(file, file.name);
  }

  async function toggleRec() {
    error = '';
    if (!recording) {
      try {
        mic = await startMic();
        recording = true;
      } catch {
        error = 'Немає доступу до мікрофона';
      }
      return;
    }
    recording = false;
    const blob = await mic!.stop();
    mic = null;
    await adopt(blob, 'Запис');
  }

  $effect(() => {
    void sampleVersion;
    void activeSlice;
    const n = track.slices;
    const buf = getSample(track.sample);
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!buf) return;
    ctx.fillStyle = 'rgba(224,179,65,.18)';
    ctx.fillRect((activeSlice / n) * w, 0, w / n, h);
    const pk = peaks(buf, Math.floor(w / 2));
    ctx.fillStyle = '#e8e8ea';
    pk.forEach((v, i) => {
      const bar = Math.max(1, v * h);
      ctx.fillRect(i * 2, (h - bar) / 2, 1.2, bar);
    });
    ctx.fillStyle = '#e0b341';
    for (let i = 1; i < n; i++) ctx.fillRect((i / n) * w - 0.5, 0, 1, h);
  });

  const hasSample = $derived(!!getSample(track.sample));
</script>

<section>
  <div class="row">
    <label class="btn" class:off={busy}>
      Завантажити
      <input type="file" accept="audio/*" onchange={pick} disabled={busy || recording} hidden />
    </label>
    <button class:rec={recording} onclick={toggleRec} disabled={busy}>{recording ? '■ Стоп' : '● Запис'}</button>
  </div>
  <p class="name">{track.sampleName || 'Семпл не вибрано'}{#if busy} · обробка…{/if}</p>
  {#if error}<p class="err" role="alert">{error}</p>{/if}

  <canvas bind:this={canvas} aria-label="Хвиля семпла"></canvas>

  <div class="row">
    <span class="lbl">Слайси</span>
    {#each SLICE_OPTIONS as n}
      <button class:sel={track.slices === n} onclick={() => store.setSlices(index, n)} aria-pressed={track.slices === n}>{n}</button>
    {/each}
  </div>

  <div class="slices" class:wide={track.slices > 8}>
    {#each Array.from({ length: track.slices }, (_, i) => i) as i}
      <button
        class:sel={activeSlice === i}
        disabled={!hasSample}
        onclick={() => { onSlice(i); void engine.audition(index, [i]); }}
        aria-pressed={activeSlice === i}
      >{i + 1}</button>
    {/each}
  </div>
  <p class="hint">Обери слайс і тапай по кроках — слайс запишеться в крок.</p>
</section>

<style>
  section { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; cursor: pointer; }
  .btn.off { opacity: .5; }
  .lbl { color: var(--dim); font-size: 14px; margin-right: 4px; }
  .name { margin: 0; font-size: 14px; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .err { margin: 0; font-size: 14px; color: #ff8a80; }
  .hint { margin: 0; font-size: 13px; color: var(--dim); }
  canvas { width: 100%; height: 80px; background: #060607; border: 1px solid var(--line); border-radius: 10px; }
  .slices { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .slices.wide { grid-template-columns: repeat(8, 1fr); }
  .slices button { min-width: 0; padding: 0; }
  .sel { background: var(--hit); color: #000; border-color: var(--hit); }
  .rec { background: #7a1f1f; border-color: #c33; }
</style>
