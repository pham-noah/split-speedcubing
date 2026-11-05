<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nav } from '../lib/nav.svelte';
  import TimerPad from '../lib/ui/TimerPad.svelte';
  import History from './History.svelte';
  import Sessions from '../lib/ui/Sessions.svelte';
  import ScrambleWalk from '../lib/ui/ScrambleWalk.svelte';
  import Deltas from '../lib/ui/Deltas.svelte';
  import ShortcutsSide from '../lib/ui/ShortcutsSide.svelte';
  import { ScrambleQueue } from '../lib/core/scramble';
  import { averageOf, best, effective, formatTime, mean, type Penalty, type Solve } from '../lib/core/stats';

  const queue = new ScrambleQueue();
  let scramble = $state('Generating scramble…');
  // History asks for a scramble to be re-timed ("retry this scramble"). Solve stays mounted while
  // History is open, so this has to be an effect on the store rather than a read at init.
  $effect(() => {
    const r = store.retry;
    if (!r) return;
    scramble = r;
    store.retry = null;
  });
  queue.take().then((s) => {
    if (scramble.startsWith('Generating')) scramble = s;
  });

  const solves = $derived(store.solves);
  const last = $derived(solves.at(-1));
  // how the last solve compares with the session average (finished solves only)
  const vsAvg = $derived.by(() => {
    const done = solves.map(effective).filter(Number.isFinite);
    if (done.length < 2 || !last) return null;
    const t = effective(last);
    if (!Number.isFinite(t)) return null;
    const avg = mean(done) ?? 0;
    return t - avg;
  });
  let history = $state(false);
  let walkIndex = $state(0);
  let undone = $state<{ solve: Solve; index: number } | null>(null);
  let undoT: ReturnType<typeof setTimeout> | undefined;
  const scrTokens = $derived(scramble.split(/\s+/).filter(Boolean));
  let sessions = $state(false);

  async function newScramble() {
    scramble = 'Generating scramble…';
    scramble = await queue.take();
  }
  async function finish(r: { ms: number; pen: Penalty }) {
    store.addSolve(r.ms, scramble, r.pen);
    await newScramble();
  }
  // deleting is undoable for a few seconds, so a stray C does not cost you a solve
  function removeLast() {
    const list = store.solves;
    const newest = list.at(-1);
    if (!newest) return;
    // the undo index is a position in the whole solve list, not in this session
    const index = store.data.solves.findIndex((x) => x.id === newest.id);
    store.deleteLast();
    undone = { solve: newest, index };
    clearTimeout(undoT);
    undoT = setTimeout(() => (undone = null), 6000);
  }
  function undoDelete() {
    if (!undone) return;
    store.restoreSolve(undone.solve, undone.index);
    undone = null;
    clearTimeout(undoT);
  }
  const typing = (e: Event) => /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
  function onKey(e: KeyboardEvent) {
    if (typing(e) || history || sessions) return;
    if (store.timerRunning) return; // the timer owns the keyboard while it runs
    if (store.is(e, 'plus2')) store.setPenalty('+2');
    else if (store.is(e, 'dnf')) store.setPenalty('DNF');
    else if (store.is(e, 'deleteLast')) removeLast();
    else if (store.is(e, 'history')) history = true;
    else if (store.is(e, 'sessions')) sessions = true;
    else if (store.is(e, 'scramble')) newScramble();
  }
    // the walkthrough eats the space the timer needs on a desktop-sized window
  let wide = $state(false);
  $effect(() => {
    const m = matchMedia('(min-width:1100px)');
    const on = () => (wide = m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  });

// Back closes history / sessions first
  $effect(() => {
    if (history || sessions)
      return nav.onBack(() => {
        history = false;
        sessions = false;
        return true;
      });
  });
</script>

<svelte:window onkeydown={onKey} />

{#if sessions}<Sessions onClose={() => (sessions = false)} />
{:else if history}<History onBack={() => (history = false)} />
{:else}
  <main class="page wide">
    <h1 class="sr">Solve</h1>
    <div class="split">
      <div class="col" style="gap:12px">
        <div class="row sp">
          <button
            class="chip"
            style="color:inherit;cursor:pointer"
            onclick={() => {
              if (!store.timerRunning) sessions = true;
            }}
            aria-label="Sessions. Current: {store.session.name}">3x3 · {store.session.name} ▾</button
          >
          <button class="btn" disabled={store.timerRunning} onclick={() => (history = true)}>History · {solves.length}</button>
        </div>
        {#if store.shown('solve.scramble')}
          <div class="scr" aria-label="Scramble" aria-live="polite">
            {#key scramble}
              {#each scrTokens as t, idx (idx)}<span class:now={idx === walkIndex} style="--i:{idx}">{t}</span>{' '}{/each}
            {/key}
          </div>
          <button class="btn" style="align-self:center;min-height:40px" onclick={newScramble}>New scramble</button>
        {/if}
        {#if store.shown('solve.cube') && !store.cubeHidden && scramble.includes(' ') && !scramble.startsWith('Generating')}
          <div class="card cube-panel" style="display:flex;justify-content:center">
            <ScrambleWalk
              size={wide ? 58 : 90}
              alg={scramble}
              autoplay={store.data.settings.walkAutoplay}
              speed={store.data.settings.walkSpeed}
              onIndex={(i) => (walkIndex = i)}
              onClose={() => (store.cubeHidden = true)}
            />
          </div>
        {:else}
          <button
            class="btn"
            style="align-self:center;min-height:0;padding:6px 12px;font-size:.8rem"
            onclick={() => (store.cubeHidden = false)}>Show the cube</button
          >
        {/if}
        {#if undone}
          <div class="card row sp" role="status" aria-live="polite" style="border-color:var(--am)">
            <span class="mu">Deleted {formatTime(undone.solve.ms)}</span>
            <button class="btn" onclick={undoDelete}>Undo</button>
          </div>
        {/if}
        {#if vsAvg != null}
          <div
            class="mu mono"
            style="text-align:center;color:{vsAvg < 0 ? 'var(--good)' : 'var(--bad)'}"
            aria-label="Compared with your session average"
          >
            {vsAvg < 0 ? '−' : '+'}{(Math.abs(vsAvg) / 1000).toFixed(2)} vs average
          </div>
        {/if}
        <div class="timer-slot">
          <TimerPad
            holdMs={store.data.settings.holdMs}
            tapStart={store.data.settings.tapStart}
            hideTime={store.data.settings.hideTime}
            inspection={store.data.settings.inspection}
            beeps={store.data.settings.beeps}
            shown={last ? effective(last) : null}
            cover={store.data.settings.coverOn}
            coverColor={store.data.settings.coverColor}
            onfinish={finish}
          />
        </div>
        {#if !solves.length}
          <div class="empty">
            <b>Ready for your first solve</b><span class="empty-how"
              >Hold the big button<span class="pc-only"> (or {store.key('timer') === 'Space' ? 'the spacebar' : 'your timer key'})</span> until
              it says Release, then let go to start. Tap anywhere to stop.</span
            >
          </div>
        {/if}
        {#if store.shown('solve.penalties')}
          <div class="row" style="justify-content:center">
            <button
              class="btn"
              class:on={last?.pen === '+2'}
              aria-pressed={last?.pen === '+2'}
              disabled={!last || store.timerRunning}
              onclick={() => store.setPenalty('+2')}>+2</button
            >
            <button
              class="btn"
              class:on={last?.pen === 'DNF'}
              aria-pressed={last?.pen === 'DNF'}
              disabled={!last || store.timerRunning}
              onclick={() => store.setPenalty('DNF')}>DNF</button
            >
            <button class="btn" disabled={!last || store.timerRunning} onclick={removeLast}>Delete</button>
          </div>
        {/if}
        {#if store.shown('solve.stats')}
          <div class="row">
            <div class="card">
              <div class="mu">Best</div>
              {#key formatTime(best(solves))}<b class="mono num">{formatTime(best(solves))}</b>{/key}
            </div>
            <div class="card">
              <div class="mu">ao5</div>
              {#key formatTime(averageOf(solves, 5))}<b class="mono num">{formatTime(averageOf(solves, 5))}</b>{/key}
            </div>
            <div class="card">
              <div class="mu">ao12</div>
              {#key formatTime(averageOf(solves, 12))}<b class="mono num">{formatTime(averageOf(solves, 12))}</b>{/key}
            </div>
          </div>
        {/if}
      </div>
      <aside class="side" aria-label="Recent solves">
        {#if store.shown('solve.recent')}
          <Deltas times={solves.map(effective)} title="Recent solves" />
        {/if}
        <ShortcutsSide view="solve" inline />
      </aside>
    </div>
  </main>
{/if}
