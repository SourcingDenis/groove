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

- **Кроки** — 16 patterns (copy / paste / clear; tap a pad while playing to queue it for the next bar), 8 tracks × 16 steps (phones show one track at a time, wide screens all of them), drag across steps to paint, mute / solo, spectrum strip. **Hold a step** to edit it: a one-octave key grid (chords on chord / bell tracks, with Maj / min / 7 / m7 / sus4 shortcuts), velocity, probability, nudge (micro-timing) and ratchet 1–4×
- **Звук** — per-track macros (tune, length, brightness); instruments: kick, snare, hat, bass, **lead**, **chord** pad and **bell** (FM); chord and bell tracks have an **arpeggiator** (up / down / up-down / random) that plays one chord note per step; the **sampler** loads a file or records from the microphone, slices it into 4 / 8 / 16 and places slices on steps
- **Мікшер** — volume, pan, delay and reverb sends, live level meters
- **Жива** — XY pad (filter / delay throw / reverb wash), hold-to-repeat 1/4 · 1/8 · 1/16, big mute / solo, visualiser
- **Пісня** — chain patterns with repeats; "Пісня" mode plays the chain bar by bar
- **Ще** — export: render the song to WAV faster than real time, or record a live set
- Play / stop, BPM ±, tap tempo, undo / redo; project and samples autosave to IndexedDB; installable PWA with PNG icons

## Layout

```
src/model.ts          project / pattern / track types and the default project
src/notes.ts          note names, chord shapes
src/engine/           sequencer.ts (pure: pattern + step -> triggers, ratchet / probability / nudge / arp expansion, song chain), instruments.ts, engine.ts (Tone), samples.ts, context.ts
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

Presets (808 / 909 / lo-fi kits, bass presets, your own), sidechain ducking, swing, typed BPM and a metronome.
