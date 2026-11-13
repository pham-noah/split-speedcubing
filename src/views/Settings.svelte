<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { toCsTimer } from '../lib/core/exporters';
  import ShortcutsPanel from '../lib/ui/ShortcutsPanel.svelte';
  import { DEFAULT_CUBE_COLORS } from '../lib/ui/cube-colors';
  import ImportPanel from '../lib/ui/ImportPanel.svelte';
  import { platform } from '$platform';
  import { issuesUrl, issueUrl, look, type Check } from '../lib/core/update';
  import { formatBytes } from '../lib/storage/durability';
  const s = $derived(store.data.settings);
  const colours = () => (s.cubeColors && s.cubeColors.length === 6 ? s.cubeColors : DEFAULT_CUBE_COLORS);
  let msg = $state('');
  let full = $state(false);
  async function toggleFull() {
    try {
      full = await platform.toggleFullscreen();
    } catch (err) {
      msg = String(err);
    }
  }
  // the store holds what the last restore or erase replaced; the button below names it
  let fsrsMsg = $state('');
  let fsrsBusy = $state(false);
  let fsrsProgress = $state(0);
  async function personalise() {
    fsrsBusy = true;
    fsrsProgress = 0;
    fsrsMsg = '';
    const r = await store.optimizeFsrs((f) => (fsrsProgress = f));
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

  // how long since the last backup, with a nudge once there is something to lose
  const backupAge = $derived.by(() => {
    const at = store.data.settings.lastBackupAt;
    const learned = Object.values(store.data.cards).some((c) => c.attempts.length) || store.solves.length > 0;
    if (!at) return { nudge: learned, text: learned ? 'No backup made yet.' : 'Nothing to back up yet.' };
    const days = Math.floor((Date.now() - at) / 86400000);
    return { nudge: days >= 14, text: days <= 0 ? 'Last backup: today.' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago.` };
  });
  async function download() {
    await platform.saveFile(`split-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson());
    store.update({ lastBackupAt: Date.now() });
    msg = 'Backup saved.';
  }
  /** the same solves in a file csTimer can read back, so leaving is not a one-way door */
  async function exportCsTimer() {
    const file = toCsTimer(
      store.data.sessions.map((sess) => ({
        name: sess.name,
        event: sess.event ?? '333',
        solves: store.data.solves.filter((x) => (x.session ?? store.data.sessions[0].id) === sess.id),
      })),
    );
    await platform.saveFile(`split-cstimer-${new Date().toISOString().slice(0, 10)}.txt`, file);
    msg = 'csTimer file saved. Import it in csTimer with the import button.';
  }
  async function restore() {
    const f = await platform.pickFile('application/json');
    if (!f) return;
    try {
      // importJson throws before it touches anything, so a wrong file costs nothing
      store.importJson(f.text);
      msg = 'Backup restored.';
    } catch (err) {
      // keep the specific reason (a backup from a newer version), not just "invalid"
      msg = err instanceof Error && /newer version/.test(err.message) ? err.message : 'That file is not a valid backup.';
    }
  }
  let update = $state<Check | null>(null);
  let updateBusy = $state(false);
  async function checkForUpdates() {
    updateBusy = true;
    update = await look(__APP_VERSION__, platform.kind);
    updateBusy = false;
  }
  function undoRestore() {
    if (!store.undoRestore()) return;
    msg = 'Undone. Your earlier data is back.';
  }
</script>

<main class="page">
  <h1>Settings</h1>

  <nav class="secnav" aria-label="Settings sections">
    {#each [['ap-h', 'Appearance'], ['tm-h', 'Timer'], ['cube-h', 'Colours'], ['walk-h', 'Walkthrough'], ['tr-h', 'Training'], ['fs-h', 'Scheduling'], ['pn-h', 'Layout'], ['bk-h', 'Data'], ['ab-h', 'About']] as [id, label] (id)}
      <button
        onclick={() => {
          const el = document.getElementById(id);
          const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
        }}>{label}</button
      >
    {/each}
  </nav>

  <section class="col" aria-labelledby="ap-h">
    <h2 id="ap-h" style="margin:0;font-size:1.15rem">Appearance</h2>
    <div class="mu" id="theme-l">Theme</div>
    <div class="seg" role="group" aria-labelledby="theme-l">
      {#each [['midnight', 'Midnight'], ['amoled', 'AMOLED'], ['contrast', 'High contrast']] as [v, l] (v)}
        <button class:on={s.theme === v} aria-pressed={s.theme === v} onclick={() => store.update({ theme: v as typeof s.theme })}
          >{l}</button
        >
      {/each}
    </div>
    <div class="mu" id="accent-l">Accent colour</div>
    <div class="accents" role="group" aria-labelledby="accent-l">
      {#each [['', 'Amber'], ['#5AA9FF', 'Blue'], ['#59D98A', 'Green'], ['#FF6B6B', 'Red'], ['#B58CFF', 'Purple'], ['#F2F2F2', 'White']] as [v, l] (v)}
        <button
          class="btn swatch"
          aria-pressed={s.accent === v}
          aria-label={l}
          title={l}
          style="background:{v || '#F5B83D'};color:#12161C;border:0"
          onclick={() => store.update({ accent: v })}>{s.accent === v ? '✓' : ''}</button
        >
      {/each}
    </div>
    <div class="mu" id="size-l">Text size</div>
    <div class="seg" role="group" aria-labelledby="size-l">
      {#each [[100, 'Normal'], [115, 'Large'], [130, 'Extra large']] as [v, l] (v)}
        <button class:on={s.textSize === v} aria-pressed={s.textSize === v} onclick={() => store.update({ textSize: v as number })}
          >{l}</button
        >
      {/each}
    </div>
  </section>

  <section class="col" aria-labelledby="tm-h">
    <h2 id="tm-h" style="margin:0;font-size:1.15rem">Timer</h2>
    <div class="mu" id="hold-l">Hold time before the timer is ready</div>
    <div class="seg" role="group" aria-labelledby="hold-l">
      {#each [150, 300, 500] as v (v)}<button
          class:on={s.holdMs === v}
          aria-pressed={s.holdMs === v}
          onclick={() => store.update({ holdMs: v })}>{v} ms</button
        >{/each}
    </div>
    <label class="row sp card"
      ><span>Start on tap (no hold)</span><input
        type="checkbox"
        style="width:24px;min-height:24px;flex:none"
        checked={s.tapStart}
        onchange={(e) => store.update({ tapStart: e.currentTarget.checked })}
      /></label
    >
    <label class="row sp card"
      ><span>15-second inspection</span><input
        type="checkbox"
        style="width:24px;min-height:24px;flex:none"
        checked={s.inspection}
        onchange={(e) => store.update({ inspection: e.currentTarget.checked })}
      /></label
    >
    {#if s.inspection}
      <label class="row sp card"
        ><span>Inspection beeps (8 s and 12 s)</span><input
          type="checkbox"
          style="width:24px;min-height:24px;flex:none"
          checked={s.beeps}
          onchange={(e) => store.update({ beeps: e.currentTarget.checked })}
        /></label
      >
    {/if}
    <label class="row sp card"
      ><span>Hide time while solving</span><input
        type="checkbox"
        style="width:24px;min-height:24px;flex:none"
        checked={s.hideTime}
        onchange={(e) => store.update({ hideTime: e.currentTarget.checked })}
      /></label
    >
    <label class="row sp card"
      ><span>Split timing<span class="mu" style="display:block;font-size:.78rem;font-weight:500"
          >Cross · F2L · OLL · PLL, marked while the clock runs</span
        ></span><input
        type="checkbox"
        style="width:24px;min-height:24px;flex:none"
        checked={s.splits === true}
        onchange={(e) => store.update({ splits: e.currentTarget.checked })}
      /></label
    >
    {#if s.splits}
      <div class="mu" style="font-size:.8rem">
        A <b>Split</b> pill appears over the timer while it runs; tap it (or press
        <b class="mono">{store.key('split') === 'Slash' ? '/' : store.key('split')}</b>) to end a phase. Tapping
        anywhere else still stops the clock.
      </div>
    {/if}
    <label class="row sp card"
      ><span>Full-screen colour while holding / solving</span><input
        type="checkbox"
        style="width:24px;min-height:24px;flex:none"
        checked={s.coverOn}
        onchange={(e) => store.update({ coverOn: e.currentTarget.checked })}
      /></label
    >
    {#if s.coverOn}
      <div class="mu" id="cover-l">Full-screen colour</div>
      <div class="row" role="group" aria-labelledby="cover-l" style="gap:8px;flex-wrap:wrap">
        {#each [['', 'Button'], ['#5AA9FF', 'Blue'], ['#F5B83D', 'Gold'], ['#59D98A', 'Green'], ['#FF6B6B', 'Red'], ['#B58CFF', 'Purple']] as [v, l] (v)}
          <button
            class="btn"
            class:on={s.coverColor === v}
            aria-pressed={s.coverColor === v}
            aria-label={l}
            title={l}
            style="flex:none;min-width:52px;{v ? `background:${v};color:#06121F;border:0;` : ''}"
            onclick={() => store.update({ coverColor: v })}>{v ? '' : 'Button'}</button
          >
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
        <input
          type="color"
          style="width:72px;min-height:36px;flex:none;padding:2px"
          value={colours()[i]}
          oninput={(e) => {
            const next = [...colours()];
            next[i] = e.currentTarget.value;
            store.update({ cubeColors: next });
          }}
        />
      </label>
    {/each}
    <label class="row sp card"
      ><span>Swap red and orange</span><input
        type="checkbox"
        style="width:24px;min-height:24px;flex:none"
        checked={s.swapRO}
        onchange={(e) => store.update({ swapRO: e.currentTarget.checked })}
      /></label
    >
    <button class="btn" onclick={() => store.update({ cubeColors: [], swapRO: false })}>Reset cube colours</button>
  </section>

  <section class="col" aria-labelledby="walk-h">
    <h2 id="walk-h" style="margin:0;font-size:1.15rem">Scramble walkthrough</h2>
    <label class="row sp card"
      ><span>Play the scramble by itself</span><input
        type="checkbox"
        style="width:24px;min-height:24px;flex:none"
        checked={s.walkAutoplay}
        onchange={(e) => store.update({ walkAutoplay: e.currentTarget.checked })}
      /></label
    >
    <div class="mu" id="speed-l">Speed of one move</div>
    <div class="seg" role="group" aria-labelledby="speed-l">
      {#each [[1500, 'Slow'], [900, 'Normal'], [450, 'Fast']] as [v, l] (v)}
        <button class:on={s.walkSpeed === v} aria-pressed={s.walkSpeed === v} onclick={() => store.update({ walkSpeed: v as number })}
          >{l}</button
        >
      {/each}
    </div>
    <div class="mu">Show or hide the cube itself under Screen layout below.</div>
  </section>

  <section class="col" aria-labelledby="tr-h">
    <h2 id="tr-h" style="margin:0;font-size:1.15rem">Training</h2>
    <div class="mu" id="ret-l">Target recall for reviews (higher = more reviews)</div>
    <div class="seg" role="group" aria-labelledby="ret-l">
      {#each [0.8, 0.85, 0.9, 0.95] as v (v)}<button
          class:on={s.retention === v}
          aria-pressed={s.retention === v}
          onclick={() => store.update({ retention: v })}>{Math.round(v * 100)}%</button
        >{/each}
    </div>
  </section>

  <section class="card col" aria-labelledby="fs-h">
    <h2 id="fs-h" style="margin:0;font-size:1.15rem">Personalise scheduling</h2>
    <div class="mu">
      Learns how fast <i>you</i> forget from your own training history and adjusts the review schedule to match. It runs on this device and only
      keeps the result if it predicts your recall better than the standard settings on cases it did not train on.
    </div>
    <div class="mu" role="status">
      {s.fsrsW ? 'Using personalised parameters.' : 'Using the standard parameters.'} Usable reviews so far:
      <b style="color:var(--tx)">{store.fsrsPoints}</b>
      (about {store.fsrsMinPoints}+ needed).
    </div>
    <div class="row">
      <button class="btn p" disabled={fsrsBusy} onclick={personalise}
        >{fsrsBusy ? `Working… ${Math.round(fsrsProgress * 100)}%` : 'Optimise from my history'}</button
      >
      {#if s.fsrsW}<button
          class="btn"
          disabled={fsrsBusy}
          onclick={() => {
            store.resetFsrs();
            fsrsMsg = 'Back to the standard parameters.';
          }}>Use standard</button
        >{/if}
    </div>
    <div class="mu" role="status" aria-live="polite">{fsrsMsg}</div>
  </section>

  <section class="card col" aria-labelledby="pn-h">
    <h2 id="pn-h" style="margin:0;font-size:1.15rem">Screen layout</h2>
    <div class="mu">Hide anything you do not need.</div>
    {#each PANELS as [id, label] (id)}
      <label class="row sp" style="min-height:44px"
        ><span>{label}</span><input
          type="checkbox"
          style="width:24px;min-height:24px;flex:none"
          checked={store.shown(id)}
          onchange={(e) => store.setShown(id, e.currentTarget.checked)}
        /></label
      >
    {/each}
  </section>

  <ShortcutsPanel />
  <ImportPanel />

  <section class="col" aria-labelledby="bk-h">
    <h2 id="bk-h" style="margin:0;font-size:1.15rem">Your data</h2>
    <div class="mu">Everything is stored only on this device. Make a backup before switching phones.</div>
    <div class="mu" style="color:{backupAge.nudge ? 'var(--am)' : 'var(--mu2)'}">{backupAge.text}</div>
    {#if store.durable.persisted !== null}
      <div class="mu" style="color:{store.durable.persisted ? 'var(--mu2)' : 'var(--am)'}">
        {#if store.durable.persisted}
          Storage: this device has agreed to keep your data.
        {:else}
          Storage: the system may free this app's data if space runs short.
          {s.autoBackup
            ? 'A copy is saved to your downloads every 7 days for that reason.'
            : 'A backup is the only copy that survives that.'}
        {/if}
        {#if store.durable.usage != null}({formatBytes(store.durable.usage)} used){/if}
      </div>
    {/if}
    <div class="row">
      {#if platform.caps.saveFile}<button class="btn" onclick={download}>Export backup</button>{/if}
      {#if platform.caps.saveFile}
        <label class="row sp" style="min-height:44px"
          ><span>Keep a safety copy</span><input
            type="checkbox"
            style="width:24px;min-height:24px;flex:none"
            checked={s.autoBackup !== false}
            onchange={(e) => store.update({ autoBackup: e.currentTarget.checked })}
          /></label
        >
        <div class="mu">
          Writes a backup to your downloads once a week when there are solves to lose, and only if this device will not promise to keep the
          data.
        </div>
      {/if}
      <button class="btn" onclick={restore}>Restore backup</button>
      {#if platform.caps.saveFile}
        <button class="btn" onclick={exportCsTimer}>Export for csTimer</button>
      {/if}
    </div>
    {#if platform.caps.fullscreen}
      <button class="btn" onclick={toggleFull}>{full ? 'Leave fullscreen' : 'Fullscreen'}<span class="pc-only"> (F11)</span></button>
    {/if}
    <button class="btn" onclick={() => store.update({ introSeen: false })}>Show the intro again</button>
    <button
      class="btn"
      onclick={() => {
        if (confirm('Erase all solves and progress on this device?')) {
          store.erase();
          msg = 'Erased. You can put it back until something else replaces it.';
        }
      }}>Erase all data</button
    >
    <div class="row sp" role="status" aria-live="polite">
      <span class="mu" style="flex:1;min-width:0">{msg}</span>
      {#if store.canUndoRestore}<button class="btn" style="flex:none" onclick={undoRestore}
          >{store.undoKind === 'erase' ? 'Undo erase' : 'Undo restore'}</button
        >{/if}
    </div>
  </section>

  <section class="card col" aria-labelledby="ab-h">
    <h2 id="ab-h" style="margin:0;font-size:1.15rem">About</h2>
    <div class="mu">
      Split {__APP_VERSION__}. Free software under the GNU General Public License v3 or later: you may use, study, share and change it.
      Includes open-source components (see THIRD_PARTY_LICENSES.md in the source). No accounts, no tracking, no network access.
    </div>
    {#if platform.caps.openLinks}
      <div class="mu">
        Built by Noah Pham. Source, releases and issues: <a
          class="link"
          href="https://github.com/pham-noah"
          target="_blank"
          rel="noopener noreferrer">github.com/pham-noah</a
        >
      </div>
      <div class="row">
        <a
          class="btn"
          style="display:flex;align-items:center;justify-content:center;text-decoration:none"
          href={issueUrl(__APP_VERSION__, platform.kind)}
          target="_blank"
          rel="noopener noreferrer">Report a problem</a
        >
        <a
          class="btn"
          style="display:flex;align-items:center;justify-content:center;text-decoration:none"
          href={issuesUrl}
          target="_blank"
          rel="noopener noreferrer">Open issues</a
        >
      </div>
      <div class="mu">
        A report opens a pre-filled GitHub issue: what happened, what you expected, and the version and shell you are on. Nothing is sent
        from the app itself.
      </div>
    {:else}
      <div class="mu">Built by Noah Pham. Source and issues: github.com/pham-noah/split-speedcubing</div>
    {/if}
    {#if platform.caps.updateCheck}
      <label class="row sp" style="min-height:44px"
        ><span>Check for updates</span><input
          type="checkbox"
          style="width:24px;min-height:24px;flex:none"
          checked={s.checkUpdates === true}
          onchange={(e) => store.update({ checkUpdates: e.currentTarget.checked })}
        /></label
      >
      {#if s.checkUpdates}
        <button class="btn" onclick={checkForUpdates} disabled={updateBusy}>{updateBusy ? 'Checking…' : 'Check now'}</button>
        {#if update?.kind === 'found'}
          <div class="mu" role="status" aria-live="polite">
            Version {update.release.version} is available.
            {#if platform.caps.openLinks}<a class="link" href={update.release.page} target="_blank" rel="noopener noreferrer"
                >Open the release page</a
              >{:else}Download it from {update.release.page}{/if}
          </div>
        {:else if update?.kind === 'current'}
          <div class="mu" role="status" aria-live="polite">Split {__APP_VERSION__} is the latest version.</div>
        {:else if update?.kind === 'unavailable'}
          <div class="mu" role="status" aria-live="polite">
            No public releases found. A check can only see a public repository, so this build cannot find updates until the releases are
            published somewhere public.
          </div>
        {:else if update?.kind === 'failed'}
          <div class="mu" role="status" aria-live="polite">Could not reach GitHub. Try again later.</div>
        {/if}
        <div class="mu">
          The check asks github.com for the newest release and sends no device id. Installing the update is left to you or to your store.
        </div>
      {/if}
    {/if}
  </section>
</main>
