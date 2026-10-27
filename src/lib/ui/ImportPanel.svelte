<script lang="ts">
  import { store } from '../store.svelte';
  import { parseImport, type ImportResult } from '../core/importers';
  let text = $state('');
  let fileName = $state('');
  let preview = $state<ImportResult | null>(null);
  let msg = $state('');

  const count = (r: ImportResult) => r.sessions.reduce((n, s) => n + s.solves.length, 0);
  function analyse(t: string) { preview = t.trim() ? parseImport(t) : null; msg = ''; }
  async function pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    fileName = f.name;
    text = await f.text();
    analyse(text);
  }
  function run() {
    if (!preview || !preview.sessions.length) return;
    const label = preview.format === 'csTimer' ? 'csTimer' : 'imported';
    const r = store.importSolves(preview.sessions, label);
    msg = r.added ? `Imported ${r.added} solves into ${r.sessions} new session${r.sessions === 1 ? '' : 's'}.${r.duplicates ? ` ${r.duplicates} duplicates skipped.` : ''}` : `Nothing new to import (${r.duplicates} duplicates).`;
    text = ''; fileName = ''; preview = null;
  }
</script>

<section class="card col" aria-labelledby="imp-h">
  <h2 id="imp-h" style="margin:0;font-size:1.15rem">Import solves</h2>
  <div class="mu">Bring your history from <b style="color:var(--tx)">csTimer</b> (Export, to file, a .txt or .json file), a CSV, or a plain list of times. CubeDesk exports are read on a best-effort basis. Each imported session becomes a new session here, and your current data is never overwritten.</div>
  <label class="btn" style="display:flex;align-items:center;justify-content:center;cursor:pointer">Choose a file<input type="file" accept=".json,.txt,.csv,text/plain,application/json,text/csv" onchange={pick} class="sr" /></label>
  {#if fileName}<div class="mu">File: {fileName}</div>{/if}
  <label class="mu" for="imp-t">…or paste times or file contents</label>
  <textarea id="imp-t" rows="3" bind:value={text} oninput={() => analyse(text)} placeholder="9.84&#10;10.55&#10;11.02+&#10;DNF"></textarea>
  {#if preview}
    <div class="card" role="status" style="background:var(--bg)">
      {#if preview.sessions.length}
        <b>{preview.format}: {count(preview)} solves in {preview.sessions.length} session{preview.sessions.length === 1 ? '' : 's'}</b>
        <div class="mu" style="margin-top:4px">{preview.sessions.slice(0, 5).map(s => `${s.name} (${s.solves.length})`).join(', ')}{preview.sessions.length > 5 ? ', …' : ''}</div>
      {:else}<b>Nothing could be read</b>{/if}
      {#each preview.notes as n, i (i)}<div class="mu" style="margin-top:4px">{n}</div>{/each}
    </div>
    <button class="btn p" disabled={!preview.sessions.length} onclick={run}>Import</button>
  {/if}
  {#if msg}<div role="status" style="font-weight:700">{msg}</div>{/if}
</section>
