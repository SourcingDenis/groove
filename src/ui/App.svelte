<script lang="ts">
  import { onMount } from 'svelte';
  import { Engine } from '../engine/engine';
  import { Store } from '../store/store';
  import { autosave, loadProject } from '../store/persist';
  import Transport from './Transport.svelte';
  import PatternPads from './PatternPads.svelte';
  import StepGrid from './StepGrid.svelte';

  const store = new Store();
  const engine = new Engine(store);

  let project = $state(store.get());
  let playing = $state(false);
  let pos = $state({ step: -1, pattern: 0 });
  let queued = $state<number | null>(null);
  let canUndo = $state(false);
  let canRedo = $state(false);

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
    void loadProject().then((p) => { if (p) store.replace(p); });
    const off = autosave((fn) => store.subscribe(fn));
    return off;
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

  <PatternPads
    patterns={project.patterns}
    current={project.current}
    playingPattern={playing ? pos.pattern : -1}
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
    onToggle={(t, s) => store.toggleStep(t, s)}
    onMute={(t) => store.toggleMute(t)}
    onSolo={(t) => store.toggleSolo(t)}
  />
</main>

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
