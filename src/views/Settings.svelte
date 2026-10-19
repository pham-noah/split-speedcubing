<script lang="ts">
  import { store } from '../lib/store.svelte';
  import ShortcutsPanel from '../lib/ui/ShortcutsPanel.svelte';
  import { DEFAULT_CUBE_COLORS } from '../lib/ui/cube-colors';
  import ImportPanel from '../lib/ui/ImportPanel.svelte';
  const s = $derived(store.data.settings);
  const colours = () => (s.cubeColors && s.cubeColors.length === 6 ? s.cubeColors : DEFAULT_CUBE_COLORS);
  let msg = $state('');
  let fsrsMsg = $state('');
  let fsrsBusy = $state(false);
  let fsrsProgress = $state(0);
  async function personalise() {
    fsrsBusy = true; fsrsProgress = 0; fsrsMsg = '';
    const r = await store.optimizeFsrs(f => (fsrsProgress = f));
    fsrsBusy = false;
    fsrsMsg = r.applied ? `Done. ${r.reason}` : r.reason;
  }

  const PANELS: [string, string][] = [
    ['solve.scramble', 'Solve: scramble'],
    ['solve.cube', 'Solve: the scramble cube'],
    ['train.cube', 'Train: the scramble cube'],
    ['solve.penalties', 'Solve: +2, DNF and Delete buttons'],
    ['solve.stats', 'Solve: best, ao5 and ao12'],
    ['solve.recent', 'Solve: last five solves'],
    ['train.hint', 'Train: tip under the scramble'],
    ['home.stats', 'Train home: recognition and execution averages'],
    ['home.drills', 'Train home: quick drills'],
  ];

  function download() {
    const url = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `split-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); URL.revokeObjectURL(url);
    msg = 'Backup saved.';
  }
  async function upload(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try { store.importJson(await f.text()); msg = 'Backup restored.'; } catch { msg = 'That file is not a valid backup.'; }
  }
</script>

<main class="page">
  <h1>Settings</h1>

  <section class="col" aria-labelledby="ap-h">
    <h2 id="ap-h" style="margin:0;font-size:1.15rem">Appearance</h2>
    <div class="mu" id="theme-l">Theme</div>
    <div class="seg" role="group" aria-labelledby="theme-l">
      {#each [['midnight', 'Midnight'], ['amoled', 'AMOLED'], ['contrast', 'High contrast']] as [v, l] (v)}
        <button class:on={s.theme === v} aria-pressed={s.theme === v} onclick={() => store.update({ theme: v as typeof s.theme })}>{l}</button>
      {/each}
    </div>
    <div class="mu" id="accent-l">Accent colour</div>
    <div class="row" role="group" aria-labelledby="accent-l" style="gap:8px;flex-wrap:wrap">
      {#each [['', 'Amber'], ['#5AA9FF', 'Blue'], ['#59D98A', 'Green'], ['#FF6B6B', 'Red'], ['#B58CFF', 'Purple'], ['#F2F2F2', 'White']] as [v, l] (v)}
        <button class="btn" class:on={s.accent === v} aria-pressed={s.accent === v} aria-label={l} title={l}
          style="flex:none;min-width:52px;{v ? `background:${v};color:#12161C;border:0;` : ''}" onclick={() => store.update({ accent: v })}>{v ? '' : 'Amber'}</button>
      {/each}
    </div>
    <div class="mu" id="size-l">Text size</div>
    <div class="seg" role="group" aria-labelledby="size-l">
      {#each [[100, 'Normal'], [115, 'Large'], [130, 'Extra large']] as [v, l] (v)}
        <button class:on={s.textSize === v} aria-pressed={s.textSize === v} onclick={() => store.update({ textSize: v as number })}>{l}</button>
      {/each}
    </div>
  </section>

  <section class="col" aria-labelledby="tm-h">
    <h2 id="tm-h" style="margin:0;font-size:1.15rem">Timer</h2>
    <div class="mu" id="hold-l">Hold time before the timer is ready</div>
    <div class="seg" role="group" aria-labelledby="hold-l">
      {#each [150, 300, 500] as v (v)}<button class:on={s.holdMs === v} aria-pressed={s.holdMs === v} onclick={() => store.update({ holdMs: v })}>{v} ms</button>{/each}
    </div>
    <label class="row sp card"><span>15-second inspection</span><input type="checkbox" style="width:24px;min-height:24px;flex:none" checked={s.inspection} onchange={(e) => store.update({ inspection: e.currentTarget.checked })} /></label>
    <label class="row sp card"><span>Inspection beeps (8 s and 12 s)</span><input type="checkbox" style="width:24px;min-height:24px;flex:none" checked={s.beeps} onchange={(e) => store.update({ beeps: e.currentTarget.checked })} /></label>
    <label class="row sp card"><span>Hide time while solving</span><input type="checkbox" style="width:24px;min-height:24px;flex:none" checked={s.hideTime} onchange={(e) => store.update({ hideTime: e.currentTarget.checked })} /></label>
    <label class="row sp card"><span>Full-screen colour while holding / solving</span><input type="checkbox" style="width:24px;min-height:24px;flex:none" checked={s.coverOn} onchange={(e) => store.update({ coverOn: e.currentTarget.checked })} /></label>
    {#if s.coverOn}
      <div class="mu" id="cover-l">Full-screen colour</div>
      <div class="row" role="group" aria-labelledby="cover-l" style="gap:8px;flex-wrap:wrap">
        {#each [['', 'Button'], ['#5AA9FF', 'Blue'], ['#F5B83D', 'Gold'], ['#59D98A', 'Green'], ['#FF6B6B', 'Red'], ['#B58CFF', 'Purple']] as [v, l] (v)}
          <button class="btn" class:on={s.coverColor === v} aria-pressed={s.coverColor === v} aria-label={l} title={l}
            style="flex:none;min-width:52px;{v ? `background:${v};color:#06121F;border:0;` : ''}" onclick={() => store.update({ coverColor: v })}>{v ? '' : 'Button'}</button>
        {/each}
      </div>
    {/if}
  </section>

  <section class="col" aria-labelledby="cube-h">
    <h2 id="cube-h" style="margin:0;font-size:1.15rem">Cube colours</h2>
    <div class="mu">Up, down, right, left, front, back — these are what the 3D cubes draw.</div>
    {#each ['U', 'D', 'R', 'L', 'F', 'B'] as f, i (f)}
      <label class="row sp card" style="min-height:52px">
        <span>{f}</span>
        <input type="color" style="width:72px;min-height:36px;flex:none;padding:2px" value={colours()[i]}
          oninput={(e) => { const next = [...colours()]; next[i] = e.currentTarget.value; store.update({ cubeColors: next }); }} />
      </label>
    {/each}
    <label class="row sp card"><span>Swap red and orange</span><input type="checkbox" style="width:24px;min-height:24px;flex:none" checked={s.swapRO} onchange={(e) => store.update({ swapRO: e.currentTarget.checked })} /></label>
    <button class="btn" onclick={() => store.update({ cubeColors: [], swapRO: false })}>Reset cube colours</button>
  </section>

  <section class="col" aria-labelledby="walk-h">
    <h2 id="walk-h" style="margin:0;font-size:1.15rem">Scramble walkthrough</h2>
    <label class="row sp card"><span>Play the scramble by itself</span><input type="checkbox" style="width:24px;min-height:24px;flex:none" checked={s.walkAutoplay} onchange={(e) => store.update({ walkAutoplay: e.currentTarget.checked })} /></label>
    <div class="mu" id="speed-l">Speed of one move</div>
    <div class="seg" role="group" aria-labelledby="speed-l">
      {#each [[1500, 'Slow'], [900, 'Normal'], [450, 'Fast']] as [v, l] (v)}
        <button class:on={s.walkSpeed === v} aria-pressed={s.walkSpeed === v} onclick={() => store.update({ walkSpeed: v as number })}>{l}</button>
      {/each}
    </div>
    <div class="mu">Show or hide the cube itself under Screen layout below.</div>
  </section>

  <section class="col" aria-labelledby="tr-h">
    <h2 id="tr-h" style="margin:0;font-size:1.15rem">Training</h2>
    <div class="mu" id="ret-l">Target recall for reviews (higher = more reviews)</div>
    <div class="seg" role="group" aria-labelledby="ret-l">
      {#each [0.8, 0.85, 0.9, 0.95] as v (v)}<button class:on={s.retention === v} aria-pressed={s.retention === v} onclick={() => store.update({ retention: v })}>{Math.round(v * 100)}%</button>{/each}
    </div>
  </section>

  <section class="card col" aria-labelledby="fs-h">
    <h2 id="fs-h" style="margin:0;font-size:1.15rem">Personalise scheduling</h2>
    <div class="mu">Learns how fast <i>you</i> forget from your own training history and adjusts the review schedule to match. It runs on this device and only keeps the result if it predicts your recall better than the standard settings on cases it did not train on.</div>
    <div class="mu" role="status">{s.fsrsW ? 'Using personalised parameters.' : 'Using the standard parameters.'} Usable reviews so far: <b style="color:var(--tx)">{store.fsrsPoints}</b> (about {store.fsrsMinPoints}+ needed).</div>
    <div class="row">
      <button class="btn p" disabled={fsrsBusy} onclick={personalise}>{fsrsBusy ? `Working… ${Math.round(fsrsProgress * 100)}%` : 'Optimise from my history'}</button>
      {#if s.fsrsW}<button class="btn" disabled={fsrsBusy} onclick={() => { store.resetFsrs(); fsrsMsg = 'Back to the standard parameters.'; }}>Use standard</button>{/if}
    </div>
    <div class="mu" role="status" aria-live="polite">{fsrsMsg}</div>
  </section>

  <section class="card col" aria-labelledby="pn-h">
    <h2 id="pn-h" style="margin:0;font-size:1.15rem">Screen layout</h2>
    <div class="mu">Hide anything you do not need.</div>
    {#each PANELS as [id, label] (id)}
      <label class="row sp" style="min-height:44px"><span>{label}</span><input type="checkbox" style="width:24px;min-height:24px;flex:none" checked={store.shown(id)} onchange={(e) => store.setShown(id, e.currentTarget.checked)} /></label>
    {/each}
  </section>

  <ShortcutsPanel />
  <ImportPanel />

  <section class="col" aria-labelledby="bk-h">
    <h2 id="bk-h" style="margin:0;font-size:1.15rem">Your data</h2>
    <div class="mu">Everything is stored only on this device. Make a backup before switching phones.</div>
    <div class="row">
      <button class="btn" onclick={download}>Export backup</button>
      <label class="btn" style="display:flex;align-items:center;justify-content:center;cursor:pointer">Restore backup<input type="file" accept="application/json" onchange={upload} class="sr" /></label>
    </div>
    <button class="btn" onclick={() => store.update({ introSeen: false })}>Show the intro again</button>
    <button class="btn" onclick={() => { if (confirm('Erase all solves and progress on this device?')) { store.erase(); msg = 'Erased.'; } }}>Erase all data</button>
    <div class="mu" role="status" aria-live="polite">{msg}</div>
  </section>

  <section class="card col" aria-labelledby="ab-h">
    <h2 id="ab-h" style="margin:0;font-size:1.15rem">About</h2>
    <div class="mu">Split {__APP_VERSION__}. Free software under the GNU General Public License v3 or later: you may use, study, share and change it. Includes open-source components (see THIRD_PARTY_LICENSES.md in the source). No accounts, no tracking, no network access.</div>
  </section>
</main>
