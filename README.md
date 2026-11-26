# Groove

A groovebox for live jamming in the browser — phone and desktop, no install. Tone.js engine, Svelte UI, installable as a PWA.

## Run

```
npm install
npm run dev        # http://localhost:5173 (also on your LAN, for testing on a phone)
npm test           # sequencer + store
npm run check      # svelte-check
npm run build
```

## What works now

- 16 patterns with copy / paste / clear; tap a pad while playing to queue it for the next bar
- 4 tracks (kick, snare, hat, bass), 16 steps, drag across steps to paint
- Play / stop, BPM ±, tap tempo, mute / solo, undo / redo
- Project autosaves to IndexedDB

## Layout

```
src/model.ts          project / pattern / track types and the default project
src/engine/           sequencer.ts (pure: pattern + step -> triggers), instruments.ts, engine.ts (Tone), context.ts
src/store/            store.ts (commands + undo), persist.ts (IndexedDB)
src/ui/               Svelte components
tests/                vitest
```

## Design notes

- One transport callback per 16th note reads the live project and triggers every audible track. It never touches the DOM; the playhead is updated through `Tone.Draw`.
- Tone's monophonic synths throw if retriggered while still ringing out, so each drum voice is a small rotating pool (`instruments.ts`). The hat is filtered noise because `MetalSynth` failed above ~200 BPM.
- iOS: `Tone.start()` runs from the Play tap and `navigator.audioSession.type = 'playback'` keeps the silent switch from muting audio.

## Roadmap

Sound page and mixer, sampler, live FX pad, song chains, WAV export (`Tone.Offline`), visualiser.
