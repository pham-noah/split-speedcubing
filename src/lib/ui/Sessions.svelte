<script lang="ts">
  import { store } from '../store.svelte';
  import { averageOf, best, effective, formatTime } from '../core/stats';
  import ShortcutsSide from './ShortcutsSide.svelte';
  const { onClose }: { onClose: () => void } = $props();
  let name = $state('');
  let editing = $state<string | null>(null);
  let editName = $state('');
  let deleted = $state<string | null>(null);   // the session just removed, while it can still be undone
  const info = (id: string) => {
    const s = store.data.solves.filter(x => x.session === id);
    const times = s.map(effective).filter(Number.isFinite);
    const mean = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const last = s.reduce((m, x) => Math.max(m, x.ts), 0);
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    const when = days == null ? 'never' : days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
    return `${s.length} solves · best ${formatTime(best(s))} · avg ${formatTime(mean)} · ao12 ${formatTime(averageOf(s, 12))} · last ${when}`;
  };
  function create() { store.addSession(name); name = ''; onClose(); }
  // Escape goes back; so does the "New scramble" key (S by default), matching the timer screen
  function onKey(e: KeyboardEvent) {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
    if (store.is(e, 'back') || store.is(e, 'scramble')) { e.preventDefault(); onClose(); }
  }
</script>

<svelte:window onkeydown={onKey} />

<main class="page">
  <div class="row sp"><h1>Sessions</h1><button class="btn" onclick={onClose}>Done</button></div>
  <div class="mu">Each session keeps its own solves and statistics. Training progress is shared.</div>
  <div role="radiogroup" aria-label="Current session" style="display:flex;flex-direction:column;gap:8px">
    {#each store.data.sessions as s (s.id)}
      <div class="card" style="display:flex;flex-direction:column;gap:8px">
        {#if editing === s.id}
          <label class="sr" for="rn">Session name</label>
          <input id="rn" bind:value={editName} onkeydown={(e) => { if (e.key === 'Enter') { store.renameSession(s.id, editName); editing = null; } }} />
          <div class="row"><button class="btn p" onclick={() => { store.renameSession(s.id, editName); editing = null; }}>Save</button><button class="btn" onclick={() => (editing = null)}>Cancel</button></div>
        {:else}
          <button role="radio" aria-checked={store.session.id === s.id} class="btn" class:on={store.session.id === s.id} style="text-align:left;padding:10px 12px;display:flex;flex-direction:column;gap:2px" onclick={() => { store.switchSession(s.id); onClose(); }}>
            <b>{s.name}</b><span class="mu">{store.session.id === s.id ? 'Current · ' : ''}{info(s.id)}</span>
          </button>
          <div class="row">
            <button class="btn" onclick={() => { editing = s.id; editName = s.name; }}>Rename</button>
            <button class="btn" onclick={() => { store.deleteSession(s.id); deleted = s.name; }}>{store.data.sessions.length > 1 ? 'Delete' : 'Clear'}</button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  {#if deleted}
    <div class="card row sp" role="status" aria-live="polite" style="border-color:var(--am)">
      <span class="mu">Deleted “{deleted}” and its solves</span>
      <button class="btn" style="flex:none" onclick={() => { if (store.undoRestore()) deleted = null; }}>Undo</button>
    </div>
  {/if}
  <div class="card" style="display:flex;flex-direction:column;gap:8px">
    <label class="mu" for="ns">New session</label>
    <input id="ns" placeholder="Name (optional)" bind:value={name} onkeydown={(e) => { if (e.key === 'Enter') create(); }} />
    <button class="btn p" onclick={create}>Create and switch</button>
  </div>
  <ShortcutsSide view="sessions" />
</main>
