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

Tabs: **Кроки · Звук · Мікшер · Жива · Пісня · Ще**

- **Кроки** — 16 patterns (copy / paste / clear; tap a pad while playing to queue it for the next bar), 5 tracks × 16 steps, drag across steps to paint, mute / solo, spectrum strip
- **Звук** — per-track macros (tune, length, brightness); the **sampler** loads a file or records from the microphone, slices it into 4 / 8 / 16 and places slices on steps
- **Мікшер** — volume, pan, delay and reverb sends, live level meters
- **Жива** — XY pad (filter / delay throw / reverb wash), hold-to-repeat 1/4 · 1/8 · 1/16, big mute / solo, visualiser
- **Пісня** — chain patterns with repeats; "Пісня" mode plays the chain bar by bar
- **Ще** — export: render the song to WAV faster than real time, or record a live set
- Play / stop, BPM ±, tap tempo, undo / redo; project and samples autosave to IndexedDB; installable PWA with PNG icons

## Layout

```
src/model.ts          project / pattern / track types and the default project
src/engine/           sequencer.ts (pure: pattern + step -> triggers, song chain), instruments.ts, engine.ts (Tone), samples.ts, context.ts
src/export/           wav.ts (encoder), render.ts (Tone.Offline render)
src/store/            store.ts (commands + undo), persist.ts (IndexedDB)
src/ui/               Svelte components
tests/                vitest
```

## Design notes

- One transport callback per 16th note reads the live project and triggers every audible track. It never touches the DOM; the playhead is updated through `Tone.Draw`.
- Tone's monophonic synths throw if retriggered while still ringing out, so each drum voice is a small rotating pool (`instruments.ts`). The hat is filtered noise because `MetalSynth` failed above ~200 BPM.
- `Tone.Offline` restores the global context as soon as rendering starts, so anything created inside a transport callback (sampler sources) is given its context explicitly. `Project` goes through a JSON round-trip before rendering because Svelte `$state` proxies can't be `structuredClone`d.
- iOS: `Tone.start()` runs from the Play tap and `navigator.audioSession.type = 'playback'` keeps the silent switch from muting audio.

## Roadmap

Note editor and step properties, lead / chord / bell instruments with an arpeggiator, presets, sidechain ducking, swing and a metronome.
