import * as Tone from 'tone';
import { Engine } from '../engine/engine';
import { songSteps } from '../engine/sequencer';
import type { Project } from '../model';
import { Store } from '../store/store';
import { audioBufferToWav } from './wav';

const TAIL_SECONDS = 2.5;
const LOOPS_WITHOUT_SONG = 4;

/** Seconds of music (without tail) that `renderProject` will produce. */
export function renderSeconds(project: Project): number {
  const steps =
    project.song.length > 0
      ? songSteps(project)
      : (project.patterns[project.current]?.length ?? 16) * LOOPS_WITHOUT_SONG;
  return steps * (60 / project.bpm / 4);
}

/**
 * Renders the song chain (or, with an empty chain, the current pattern x4) faster than
 * real time, with the same Engine the live view uses.
 */
export async function renderProject(project: Project): Promise<Blob> {
  // JSON round-trip: `project` can be a Svelte $state proxy, which structuredClone rejects
  const p: Project = JSON.parse(JSON.stringify(project));
  p.songMode = p.song.length > 0;
  const duration = renderSeconds(p) + TAIL_SECONDS;

  const buf = await Tone.Offline(async () => {
    const engine = new Engine(new Store(p), true);
    await engine.ensureBuilt();
    engine.startAt(0);
  }, duration, 2, 44100);

  return audioBufferToWav(buf.get() as AudioBuffer);
}

/** Decode a recorded container blob (webm/ogg/mp4) and re-encode it as WAV. */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const data = await blob.arrayBuffer();
  const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(data);
  return audioBufferToWav(buf);
}
