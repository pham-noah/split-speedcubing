<script lang="ts">
  import { store } from '../store.svelte';
  import { COMMANDS, SCOPE_NAMES, codeLabel, type Scope } from '../core/shortcuts';

  let capturing = $state<string | null>(null);
  let msg = $state('');

  // while a row is waiting for a key, take the next key press before anything else sees it
  $effect(() => {
    if (!capturing) return;
    const id = capturing;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape') { capturing = null; msg = 'Cancelled.'; return; }
      const err = store.setKey(id, e.code);
      msg = err ?? `Bound to ${codeLabel(e.code)}.`;
      if (!err) capturing = null;
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  });
  const scopes: Scope[] = ['global', 'solve', 'train', 'library'];
</script>

<section class="card col" aria-labelledby="sc-h">
  <h2 id="sc-h" style="margin:0;font-size:1.15rem">Keyboard shortcuts</h2>
  <div class="mu">Choose a command, then press the key you want. Escape cancels while choosing.</div>
  {#each scopes as sc (sc)}
    <div class="mu" style="margin-top:6px"><b style="color:var(--tx)">{SCOPE_NAMES[sc]}</b></div>
    {#each COMMANDS.filter(c => c.scope === sc) as c (c.id)}
      <div class="row sp" style="min-height:44px">
        <span>{c.label}</span>
        <button class="btn" style="min-height:40px;min-width:96px" aria-label="{c.label}: {codeLabel(store.key(c.id))}. Change" onclick={() => { capturing = c.id; msg = 'Press a key…'; }}>
          {capturing === c.id ? 'Press a key…' : codeLabel(store.key(c.id))}
        </button>
      </div>
    {/each}
  {/each}
  <div class="row"><button class="btn" onclick={() => { store.resetKeys(); msg = 'Shortcuts reset.'; }}>Reset all shortcuts</button></div>
  <div class="mu" role="status" aria-live="polite">{msg}</div>
</section>
