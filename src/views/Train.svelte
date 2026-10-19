<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nav } from '../lib/nav.svelte';
  import { SET_NAMES, SLOTS, SLOT_NAMES, type CaseDef, type CaseSet, type Slot } from '../lib/data';
  import TimerPad from '../lib/ui/TimerPad.svelte';
  import ShortcutsSide from '../lib/ui/ShortcutsSide.svelte';
  import ScrambleWalk from '../lib/ui/ScrambleWalk.svelte';
  import Deltas from '../lib/ui/Deltas.svelte';
  import TrainHistory from '../lib/ui/TrainHistory.svelte';
  import { hoverEnter, hoverLeave } from '../lib/ui/hover';
  import CaseDiagram from '../lib/ui/CaseDiagram.svelte';
  import { caseScramble, invert, randomAuf } from '../lib/core/alg';
  import { pickNext, mastery, type Grade } from '../lib/core/srs';
  import { formatTime } from '../lib/core/stats';
  import { codeLabel } from '../lib/core/shortcuts';

  const TARGET: Record<CaseSet, number> = { PLL: 3000, OLL: 3500, F2L: 3500, ZBLL: 5000 };
  const HINT: Record<CaseSet, string> = {
    PLL: 'Last layer on top (yellow), F2L solved.',
    OLL: 'Last layer on top (yellow), F2L solved.',
    F2L: 'Hold white on the bottom and green in front. The cross and the other three pairs are solved.',
    ZBLL: 'Last layer on top (yellow), F2L solved, edges oriented.',
  };
  const DRILLS = [
    { mode: 'cross' as const, label: 'Cross only, plan it in inspection' },
    { mode: 'oll2' as const, label: '2-look OLL' },
    { mode: 'pll2' as const, label: '2-look PLL' },
    { mode: 'bld' as const, label: 'BLD memo timing' },
  ];

  let set = $state<CaseSet>('PLL');
  let started = $state(false);   // Today screen first, unless a case was chosen in the Library
  let drill = $state<string | null>(null);
  let hist = $state(false);
  let walkIndex = $state(0);
  let weak = $state(false);
  let slotFilter = $state<Slot | 'All'>('All');
  let current = $state<CaseDef | null>(null);
  let auf = $state('');
  let result = $state<{ ms: number; recog: number | null } | null>(null);
  let lastId: string | null = null;

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const inScope = (c: CaseDef) => set !== 'F2L' || slotFilter === 'All' || c.slot === slotFilter;
  const list = $derived(store.casesFor(set).filter(inScope));
  const cards = $derived(store.cardsFor(set));
  const due = $derived(list.filter(c => cards[c.id].seen && cards[c.id].due <= Date.now()).length);
  const fresh = $derived(list.filter(c => !cards[c.id].seen).length);

  // averages over the last 7 days, across every set
  const week = $derived.by(() => {
    const since = Date.now() - 7 * 86_400_000;
    const a = Object.values(store.data.cards).flatMap(c => c.attempts).filter(x => x.ts >= since && x.recog != null);
    return { n: a.length, recog: mean(a.map(x => x.recog!)), exec: mean(a.map(x => x.total - x.recog!)) };
  });
  // the ten slowest cases (by average execution) among those with at least two timed attempts
  const weakList = $derived(weakCases());
  function weakCases(): CaseDef[] {
    const avg = (c: CaseDef) => mean(store.card(c.id).attempts.filter(x => x.recog != null).slice(-8).map(x => x.total - x.recog!));
    const timed = list.filter(c => store.card(c.id).attempts.filter(x => x.recog != null).length >= 2);
    return timed.sort((a, b) => (avg(b) ?? 0) - (avg(a) ?? 0)).slice(0, 10);
  }

  function next() {
    result = null;
    drill = null; // moving on ends an algorithm drill
    let c: CaseDef | null = null;
    if (store.focusId) { c = store.caseOf(store.focusId); set = c.set; store.focusId = null; }
    else if (weak) { c = pickNext(weakList, store.cardsFor(set), lastId, 0); }
    else c = pickNext(store.casesFor(set).filter(inScope), store.cardsFor(set), lastId);
    current = c; auf = randomAuf(); lastId = c?.id ?? null;
  }
  function start(isWeak = false) { weak = isWeak; lastId = null; started = true; next(); }
  function end() { drill = null; started = false; }
  if (store.focusId) {
    // the Library can ask for one algorithm of a case: pin it, and never fall back to another one
    const id = store.focusId;
    const pin = store.focusAlg && store.algsFor(id).includes(store.focusAlg) ? store.focusAlg : null;
    store.focusAlg = null;
    started = true; next();
    drill = pin; // the case just picked stays pinned to this algorithm until Next
  }

  const alg = $derived(current ? (drill ?? store.algFor(current.id)) : '');
  const scramble = $derived(current ? caseScramble(alg, auf, current.set === 'F2L') : '');
  const scrTokens = $derived(scramble.split(/\s+/).filter(Boolean));
  const mode = $derived(set === 'F2L' ? 'f2l' : set === 'OLL' ? 'oll' : 'pll');
  // attempts as execution time; the side panel shows the last five with deltas
  const attempts = $derived(current ? store.card(current.id).attempts : []);
  const execOf = (a: { total: number; recog: number | null }) => a.total - (a.recog ?? 0);
  const avgOf = (n: number) => { const xs = attempts.map(execOf).slice(-n); return xs.length === n ? xs.reduce((p, q) => p + q, 0) / n : null; };
  const ao5 = $derived(avgOf(5)), ao12 = $derived(avgOf(12));
  const meanUpTo = (end: number, n: number) => { const xs = attempts.slice(Math.max(0, end - n + 1), end + 1).map(execOf); return xs.length === n ? xs.reduce((p, q) => p + q, 0) / n : null; };
  const delta = (x: number | null) => (x == null ? '–' : `${x >= 0 ? '+' : '−'}${(Math.abs(x) / 1000).toFixed(2)}`);
  const dcol = (x: number | null) => (x == null ? 'var(--mu)' : x < 0 ? '#59D98A' : '#FF6B6B'); // faster green, slower red
  const recent = $derived.by(() => {
    const ex = attempts.map(execOf);
    return attempts.map((a, i) => ({
      ts: a.ts,
      total: a.total,
      prev: i ? ex[i] - ex[i - 1] : null,
      a5: meanUpTo(i, 5) == null ? null : ex[i] - meanUpTo(i, 5)!,
      a12: meanUpTo(i, 12) == null ? null : ex[i] - meanUpTo(i, 12)!,
    })).slice(-5).reverse();
  });

  // every finished attempt is recorded and scheduled as a normal review: no performance grading
  function finish(r: { ms: number; recog: number | null }) {
    if (!current) return;
    store.grade(current.id, 2, r.ms, r.recog, drill ?? undefined);
    result = r;
  }
  const typing = (e: Event) => /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
  function onKey(e: KeyboardEvent) {
    if (typing(e)) return;
    // Today screen: A / D switch the case set, S opens the training history, Enter starts
    if (!started && !hist) {
      if (store.is(e, 'trainPrev')) { set = SET_NAMES[(SET_NAMES.indexOf(set) - 1 + SET_NAMES.length) % SET_NAMES.length]; e.preventDefault(); return; }
      if (store.is(e, 'trainNext')) { set = SET_NAMES[(SET_NAMES.indexOf(set) + 1) % SET_NAMES.length]; e.preventDefault(); return; }
      if (store.is(e, 'trainHistory')) { hist = true; e.preventDefault(); return; }
      if (e.key === 'Enter' && list.length) { start(); e.preventDefault(); return; }
      return;
    }
    if (!started) return;
    if (store.is(e, 'nextCase')) { lastId = current?.id ?? null; next(); }
  }
  // Back leaves the session and returns to the Today screen
  $effect(() => { if (started) return nav.onBack(() => { end(); return true; }); });
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long' });
</script>

<svelte:window onkeydown={onKey} />

{#if hist}
  <TrainHistory onBack={() => (hist = false)} />
{:else if !started}
  <main class="page">
    <div><div class="mu">{today}</div><h1>Today</h1></div>
    <button class="btn" style="flex:none" onclick={() => (hist = true)}>History</button>
    <div class="seg" role="group" aria-label="Case set">
      {#each SET_NAMES as s (s)}<button class:on={set === s} aria-pressed={set === s} onclick={() => (set = s)} onpointerenter={() => hoverEnter(() => (set = s))} onpointerleave={hoverLeave}>{s}</button>{/each}
    </div>
    {#if set === 'F2L'}
      <div class="seg" role="group" aria-label="F2L slot">
        {#each ['All', ...SLOTS] as sl (sl)}<button class:on={slotFilter === sl} aria-pressed={slotFilter === sl} onclick={() => (slotFilter = sl as Slot | 'All')} onpointerenter={() => hoverEnter(() => (slotFilter = sl as Slot | 'All'))} onpointerleave={hoverLeave}>{sl}</button>{/each}
      </div>
    {/if}

    <div class="card hero">
      <div class="mu">Due for review</div>
      <div class="row" style="align-items:baseline;gap:8px;flex:none"><span class="n mono" style="flex:none">{due}</span><span class="mu" style="flex:none">case{due === 1 ? '' : 's'}</span></div>
      {#if list.length}
        <div class="mu">plus {fresh} new case{fresh === 1 ? '' : 's'} available</div>
        <button class="btn p big-cta" onclick={() => start()}>Start session</button>
      {:else}
        <div class="empty" style="padding:10px 0 0"><b>No {set} cases yet</b>Open the Library, ZBLL tab, and import your own algorithm list to train them.</div>
      {/if}
    </div>

    {#if store.shown('home.stats')}
      <div class="row">
        <div class="card"><div class="mu">Recognition</div><div class="mono" style="font-weight:800;font-size:1.5rem;margin-top:4px">{formatTime(week.recog)}</div><div class="mu">avg this week</div></div>
        <div class="card"><div class="mu">Execution</div><div class="mono" style="font-weight:800;font-size:1.5rem;margin-top:4px">{formatTime(week.exec)}</div><div class="mu">avg this week</div></div>
      </div>
      {#if !week.n}<div class="mu" style="text-align:center">Your averages appear here after your first training session.</div>{/if}
    {/if}

    {#if store.shown('home.drills')}
      <div class="mu">Quick drills</div>
      <div class="col">
        <button class="btn row-btn" disabled={weakList.length === 0} onclick={() => start(true)}>Weak spots, your slowest 10 {set} cases{weakList.length === 0 ? ' (train a few first)' : ''}</button>
        {#each DRILLS as d (d.mode)}<button class="btn row-btn" onclick={() => { nav.drillMode = d.mode; nav.go('drills'); }}>{d.label}</button>{/each}
      </div>
    {/if}
  <ShortcutsSide view="train" />
  </main>
{:else}
  <div class="page wide" style="gap:0">
    <div class="split">
      <main style="display:flex;flex-direction:column;gap:14px">
        <div class="row sp"><span class="chip">{drill && current ? `Algorithm drill · ${current.name}` : `Recognition · ${set}`}{weak ? ' · weak spots' : ''}{set === 'F2L' && slotFilter !== 'All' ? ` · ${slotFilter}` : ''}</span><button class="btn" onclick={end}>End session</button></div>
        <div class="row sp"><span class="mu">{drill ? 'One algorithm, execution only' : 'Recognition first, then execution'} · {drill ? '' : `${due} due · ${fresh} new`}</span><span class="mu">{current ? mastery(cards[current.id]) : ''}</span></div>

        {#if current}
          <div class="card" style="text-align:center">
            {#if !result}<div class="mu">Scramble</div>{/if}
            <div class="scr" style="margin-top:{result ? 0 : 8}px">{#each scrTokens as t, idx (idx)}<span class:now={idx === walkIndex}>{t}</span> {/each}</div>
            {#if store.shown('train.cube') && !store.cubeHidden}<div class="cube-panel" style="margin-top:8px;display:flex;justify-content:center"><ScrambleWalk alg={scramble} size={84} autoplay={store.data.settings.walkAutoplay} speed={store.data.settings.walkSpeed} onIndex={(i) => (walkIndex = i)} onClose={() => (store.cubeHidden = true)} /></div>{:else}<button class="btn" style="align-self:center;min-height:0;padding:6px 12px;font-size:.8rem" onclick={() => (store.cubeHidden = false)}>Show the cube</button>{/if}
            {#if !result && store.shown('train.hint')}<div class="mu" style="margin-top:6px">{HINT[set]}{#if set === 'F2L' && current.slot} Solve the <b style="color:var(--tx)">{SLOT_NAMES[current.slot]}</b> pair.{/if}</div>{/if}
          </div>

          <TimerPad twoPress={!drill} holdMs={store.data.settings.holdMs} cover={store.data.settings.coverOn} coverColor={store.data.settings.coverColor} onfinish={finish} />
          {#if result}
            <div class="mu" style="text-align:center">
              Last <b class="mono" style="color:var(--tx)">{formatTime(result.ms)}</b>{#if result.recog != null} · recog <b class="mono" style="color:var(--tx)">{formatTime(result.recog)}</b> · exec <b class="mono" style="color:var(--tx)">{formatTime(result.ms - result.recog)}</b>{/if}
              · {current.name}{#if current.nick} ({current.nick}){/if}
            </div>
          {:else}
            <div class="mu" style="text-align:center">{drill ? 'Execution only: hold to start, release to go, then tap to stop.' : 'Press once when you recognise the case, again when you finish.'}</div>
          {/if}
          <button class="btn" onclick={() => { lastId = current?.id ?? null; next(); }}>{drill ? 'Next case' : 'Skip case'}<span class="pc-only"> ({codeLabel(store.key("nextCase"))})</span></button>
        {:else}
          <div class="card empty">
            <b>Nothing to train here</b>
            {#if weak}Do a few normal sessions first: the weak-spots list needs at least two timed attempts per case.{:else}This set has no cases yet.{/if}
          </div>
        {/if}
      </main>

      <aside class="side" aria-label="Case details">
        <div>
          <div class="mu">Algorithm</div>
          <div class="mono" style="margin-top:6px;word-break:break-word">{result || drill ? alg : 'Shown after you finish.'}</div>
        </div>
        {#if current}
          <Deltas times={attempts.map(execOf)} title="Recent attempts on this case" />
        {/if}
        <div>
          <div class="mu">Shortcuts</div>
          {#each [['Hold to start', 'timer'], ['Skip case', 'nextCase']] as [l, id] (id)}
            <div class="row sp" style="padding:4px 0"><span class="mu">{l}</span><kbd class="kbd">{codeLabel(store.key(id))}</kbd></div>
          {/each}
        </div>
      </aside>
    </div>
  </div>
{/if}
