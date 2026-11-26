<script lang="ts">
  import type { Project } from '../model';
  import type { Engine } from '../engine/engine';
  import { blobToWav, renderProject, renderSeconds } from '../export/render';
  import { download } from '../export/wav';

  let { project, engine }: { project: Project; engine: Engine } = $props();

  let busy = $state(false);
  let recording = $state(false);
  let status = $state('');
  let error = $state('');

  const seconds = $derived(Math.round(renderSeconds(project)));
  const what = $derived(project.song.length ? 'весь ланцюжок «Пісні»' : 'поточний патерн ×4');

  async function render() {
    busy = true;
    error = '';
    status = 'Рендерю…';
    try {
      const wav = await renderProject(project);
      download(wav, 'groove-song.wav');
      status = 'Готово: groove-song.wav';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Не вдалося відрендерити';
      status = '';
    } finally {
      busy = false;
    }
  }

  async function toggleRecord() {
    error = '';
    if (!recording) {
      try {
        await engine.startRecording();
        recording = true;
        status = 'Іде запис. Грай і міксуй — натисни «Стоп», коли закінчиш.';
      } catch {
        error = 'Не вдалося почати запис';
      }
      return;
    }
    recording = false;
    busy = true;
    try {
      const blob = await engine.stopRecording();
      download(await blobToWav(blob), 'groove-set.wav');
      status = 'Готово: groove-set.wav';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Не вдалося зберегти запис';
      status = '';
    } finally {
      busy = false;
    }
  }
</script>

<section class="page">
  <h2>Експорт WAV</h2>

  <div class="card">
    <h3>Рендер пісні</h3>
    <p>Швидше за реальний час: {what}, ≈ {seconds} с + хвіст.</p>
    <button onclick={render} disabled={busy || recording}>Зберегти WAV</button>
  </div>

  <div class="card">
    <h3>Запис сету</h3>
    <p>Записує все, що ти чуєш: мʼюти, ефекти на XY-педі, повтори.</p>
    <button class:rec={recording} onclick={toggleRecord} disabled={busy}>{recording ? '■ Стоп і зберегти' : '● Почати запис'}</button>
  </div>

  {#if status}<p class="status" role="status">{status}</p>{/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 4px 4px 0; font-size: 18px; }
  h3 { margin: 0; font-size: 15px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  p { margin: 0; font-size: 14px; color: var(--dim); }
  .status { padding: 0 4px; }
  .err { padding: 0 4px; color: #ff8a80; }
  .rec { background: #7a1f1f; border-color: #c33; }
</style>
