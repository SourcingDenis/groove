<script lang="ts">
  import { onMount } from 'svelte';
  import { Engine } from '../engine/engine';
  import { registerSample } from '../engine/samples';
  import { Store } from '../store/store';
  import { autosave, loadProject, loadSample } from '../store/persist';
  import LivePage from './LivePage.svelte';
  import MixerPage from './MixerPage.svelte';
  import MorePage from './MorePage.svelte';
  import PatternPads from './PatternPads.svelte';
  import SongPage from './SongPage.svelte';
  import SoundPage from './SoundPage.svelte';
  import StepGrid from './StepGrid.svelte';
  import Tabs, { type TabId } from './Tabs.svelte';
  import Transport from './Transport.svelte';
  import Visualizer from './Visualizer.svelte';

  const store = new Store();
  const engine = new Engine(store);

  let project = $state(store.get());
  let playing = $state(false);
  let pos = $state({ step: -1, pattern: 0, songIndex: -1 });
  let queued = $state<number | null>(null);
  let canUndo = $state(false);
  let canRedo = $state(false);
  let tab = $state<TabId>('steps');
  let soundTrack = $state(0);
  let activeSlice = $state(0);
  let sampleVersion = $state(0);

  store.subscribe((p) => {
    project = p;
    canUndo = store.canUndo;
    canRedo = store.canRedo;
  });
  engine.onPosition = (p) => {
    pos = p;
    queued = engine.queuedPattern;
  };

  onMount(() => {
    void (async () => {
      const saved = await loadProject();
      if (!saved) return;
      store.replace(saved);
      // decode stored samples back into memory
      for (const t of saved.tracks) {
        if (!t.sample) continue;
        const blob = await loadSample(t.sample);
        if (blob) await registerSample(t.sample, blob).catch(() => {});
      }
      sampleVersion++;
    })();
    return autosave((fn) => store.subscribe(fn));
  });

  async function toggle() {
    if (engine.isPlaying) {
      engine.stop();
      playing = false;
    } else {
      await engine.play();
      playing = true;
    }
  }

  function pickPattern(i: number) {
    engine.queuePattern(i);
    queued = engine.queuedPattern;
  }

  const playingPattern = $derived(playing ? pos.pattern : -1);
</script>

<main>
  <Transport
    {playing}
    bpm={project.bpm}
    {canUndo}
    {canRedo}
    onToggle={toggle}
    onBpm={(b) => store.setBpm(b)}
    onUndo={() => store.undo()}
    onRedo={() => store.redo()}
  />

  {#if tab === 'steps'}
    <Visualizer bins={() => engine.bins()} height={56} />
    <PatternPads
      patterns={project.patterns}
      current={project.current}
      {playingPattern}
      {queued}
      onPick={pickPattern}
      onCopy={() => store.copyPattern()}
      onPaste={() => store.pastePattern()}
      onClear={() => store.clearPattern()}
    />
    <StepGrid
      tracks={project.tracks}
      steps={project.patterns[project.current].steps}
      playhead={playing && pos.pattern === project.current ? pos.step : -1}
      onToggle={(t, s) => store.toggleStep(t, s, activeSlice)}
      onMute={(t) => store.toggleMute(t)}
      onSolo={(t) => store.toggleSolo(t)}
    />
  {:else if tab === 'sound'}
    <SoundPage
      {project}
      {store}
      {engine}
      selected={soundTrack}
      onSelect={(i) => (soundTrack = i)}
      {activeSlice}
      {sampleVersion}
      onSlice={(n) => (activeSlice = n)}
      onLoaded={() => sampleVersion++}
    />
  {:else if tab === 'mixer'}
    <MixerPage {project} {store} {engine} />
  {:else if tab === 'live'}
    <LivePage {project} {store} {engine} {playingPattern} {queued} onPick={pickPattern} />
  {:else if tab === 'song'}
    <SongPage {project} {store} songIndex={playing ? pos.songIndex : -1} />
  {:else}
    <MorePage {project} {engine} />
  {/if}
</main>

<Tabs {tab} onTab={(t) => (tab = t)} />

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 4px 4px calc(64px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
