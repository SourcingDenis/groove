/** Decoded sample buffers by id. Blobs live in IndexedDB (store/persist.ts); the project only holds ids. */
const cache = new Map<string, AudioBuffer>();
export const MAX_SAMPLE_SECONDS = 60;

export const getSample = (id: string | null): AudioBuffer | null => (id ? cache.get(id) ?? null : null);

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const data = await blob.arrayBuffer();
  // an offline context decodes without needing a user gesture
  return new OfflineAudioContext(2, 1, 44100).decodeAudioData(data);
}

export async function registerSample(id: string, blob: Blob): Promise<AudioBuffer> {
  const buf = await decodeBlob(blob);
  if (buf.duration > MAX_SAMPLE_SECONDS) throw new Error(`Семпл довший за ${MAX_SAMPLE_SECONDS} с`);
  cache.set(id, buf);
  return buf;
}

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/** Max-abs peaks per bucket, for drawing the waveform. */
export function peaks(buf: AudioBuffer, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  const ch = buf.getChannelData(0);
  const per = Math.max(1, Math.floor(ch.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let m = 0;
    for (let i = b * per; i < Math.min(ch.length, (b + 1) * per); i++) m = Math.max(m, Math.abs(ch[i]));
    out[b] = m;
  }
  return out;
}

/** Microphone capture. Resolves with a Blob when `stop` is called. */
export async function startMic(): Promise<{ stop: () => Promise<Blob> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: rec.mimeType }));
        };
        rec.stop();
      }),
  };
}
