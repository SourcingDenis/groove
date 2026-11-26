<script lang="ts">
  export type TabId = 'steps' | 'sound' | 'mixer' | 'live' | 'song' | 'more';
  const TABS: { id: TabId; label: string }[] = [
    { id: 'steps', label: 'Кроки' },
    { id: 'sound', label: 'Звук' },
    { id: 'mixer', label: 'Мікшер' },
    { id: 'live', label: 'Жива' },
    { id: 'song', label: 'Пісня' },
    { id: 'more', label: 'Ще' },
  ];
  let { tab, onTab }: { tab: TabId; onTab: (t: TabId) => void } = $props();
</script>

<div class="tabs" role="tablist">
  {#each TABS as t}
    <button role="tab" aria-selected={t.id === tab} class:sel={t.id === tab} onclick={() => onTab(t.id)}>{t.label}</button>
  {/each}
</div>

<style>
  .tabs {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px;
    padding: 4px 4px calc(4px + env(safe-area-inset-bottom));
    background: var(--panel); border-top: 1px solid var(--line);
  }
  button { min-width: 0; padding: 0 2px; font-size: 13px; min-height: 48px; border-radius: 10px; color: var(--dim); background: transparent; border-color: transparent; }
  .sel { background: var(--panel-2); color: var(--text); border-color: var(--line); box-shadow: inset 0 -3px 0 var(--accent); }
</style>
