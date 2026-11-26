import { openDB } from 'idb';
import { PROJECT_VERSION, type Project } from '../model';

const KEY = 'project';

const db = () =>
  openDB('groove', 2, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('samples')) d.createObjectStore('samples');
    },
  });

/** Storage can be blocked (private mode); never let that break playback. */
export async function loadProject(): Promise<Project | null> {
  try {
    const p = (await (await db()).get('kv', KEY)) as Project | undefined;
    return p && p.version === PROJECT_VERSION ? p : null;
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

export async function saveSample(id: string, blob: Blob): Promise<void> {
  try {
    await (await db()).put('samples', blob, id);
  } catch {
    /* ignore: the sample still plays this session */
  }
}

export async function loadSample(id: string): Promise<Blob | null> {
  try {
    return ((await (await db()).get('samples', id)) as Blob | undefined) ?? null;
  } catch {
    return null;
  }
}

export function autosave(subscribe: (fn: (p: Project) => void) => () => void, delay = 400) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return subscribe((p) => {
    clearTimeout(t);
    t = setTimeout(() => void saveProject(p), delay);
  });
}
