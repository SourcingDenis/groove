import * as Tone from 'tone';

let ready = false;

/**
 * Create the audio context. Must run before any Tone node is built, and `unlock`
 * must be called from a user gesture (iOS / Chrome autoplay rules).
 */
export function setupContext() {
  if (ready) return;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  // Stability over instant response on phones: a longer lookahead rides out main-thread hiccups.
  Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: coarse ? 0.15 : 0.1 }));
  ready = true;
}

export async function unlock() {
  setupContext();
  // Safari 17+: without this the iPhone silent switch mutes Web Audio.
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch { /* ignore */ }
  await Tone.start();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void Tone.getContext().resume();
    });
  }
}
