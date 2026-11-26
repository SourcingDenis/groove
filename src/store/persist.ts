import { openDB } from 'idb';
import type { Project } from '../model';

const DB = 'groove';
const KEY = 'project';

const db = () => openDB(DB, 1, { upgrade(d) { d.createObjectStore('kv'); } });

/** Storage can be blocked (private mode); never let that break playback. */
export async function loadProject(): Promise<Project | null> {
  try {
    return ((await (await db()).get('kv', KEY)) as Project | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveProject(p: Project): Promise<void> {
  try {
    await (await db()).put('kv', p, KEY);
  } catch {
    /* ignore */
  }
}

export function autosave(subscribe: (fn: (p: Project) => void) => () => void, delay = 400) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return subscribe((p) => {
    clearTimeout(t);
    t = setTimeout(() => void saveProject(p), delay);
  });
}
