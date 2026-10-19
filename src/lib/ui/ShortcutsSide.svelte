<script lang="ts">
  import { onDestroy } from 'svelte';
  import { store } from '../store.svelte';
  import { codeLabel } from '../core/shortcuts';
  import type { View } from '../nav.svelte';

  type Page = View | 'history' | 'sessions';

  // A right rail with the same look as the trainer's side panel, on every screen,
  // but only with the keys that actually do something on that screen.
  let { view, inline = false }: { view: Page; inline?: boolean } = $props();

  const PAGE: Record<Page, string[]> = {
    history: ['back'],
    sessions: ['back'],
    solve: ['timer', 'cube', 'scramble', 'sessions', 'history', 'plus2', 'dnf', 'deleteLast'],
    train: ['timer', 'cube', 'nextCase', 'trainPrev', 'trainNext', 'trainHistory'],
    drills: ['timer', 'cube'],
    lib: ['hints', 'cube', 'libPrev', 'libNext'],
    set: [],
  };
  const TAB: Record<Page, string> = { history: 'goSolve', sessions: 'goSolve', solve: 'goSolve', train: 'goTrain', lib: 'goLibrary', drills: 'goDrills', set: 'goSettings' };
  const SHORT: Record<string, string> = {
    timer: 'Start / stop the timer', cube: 'Show / hide the cube', back: 'Back / close', plus2: '+2 on the last solve', dnf: 'DNF on the last solve',
    sessions: 'Open sessions', scramble: 'New scramble',
    deleteLast: 'Delete the last solve', history: 'Open history',
    nextCase: 'Skip to the next case', hints: 'Type a case code',
    libPrev: 'Previous case set', libNext: 'Next case set',
    trainPrev: 'Previous case set', trainNext: 'Next case set', trainHistory: 'Training history',
    tabPrev: 'Previous tab', tabNext: 'Next tab',
    goSolve: 'Go to Solve', goTrain: 'Go to Train', goLibrary: 'Go to Library', goDrills: 'Go to Drills', goSettings: 'Go to Settings',
  };
  const ids = $derived([...new Set([...PAGE[view], 'back', 'tabPrev', 'tabNext', ...Object.values(TAB).filter(id => id !== TAB[view])])]);

  // the rail is fixed on the right, so the page keeps clear of it (desktop only, see app.css)
  $effect(() => {
    if (inline) return;                       // in a page column there is no fixed rail to make room for
    document.body.classList.add('has-rail');
    return () => document.body.classList.remove('has-rail');
  });
</script>

<svelte:element this={inline ? 'div' : 'aside'} class={inline ? '' : 'rail'} aria-label="Keyboard shortcuts on this screen">
  <div class="mu">Shortcuts on this screen</div>
  <div class="col" style="gap:2px">
    {#each ids as id}
      <div class="row sp" style="padding:3px 0"><span class="mu">{SHORT[id]}</span><kbd class="kbd">{codeLabel(store.key(id))}</kbd></div>
    {/each}
  </div>
  <div class="mu">Arrow keys move between the buttons on the screen.</div>
  <div class="mu">Change any of these in Settings.</div>
</svelte:element>
