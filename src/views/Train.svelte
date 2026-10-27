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
  import CaseCube from '../lib/ui/CaseCube.svelte';
  import PenaltyRow from '../lib/ui/PenaltyRow.svelte';
  import { caseScramble, randomAuf } from '../lib/core/alg';
  import { pickNext, mastery, gradeForAttempt } from '../lib/core/srs';
  import { CASE_TARGET_MS } from '../lib/core/targets';
  import { formatTime, type Penalty } from '../lib/core/stats';
  import { codeLabel } from '../lib/core/shortcuts';

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
  let sessionStart = $state(0);   // attempts after this moment count towards the session line
  let summary = $state<{ n: number; best: number | null; avg: number | null } | null>(null);
  let weak = $state(false);
  let lapsed = $state(false);   // the cases you got wrong last time
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
  // cases the scheduler has marked as lapsed, plus ones whose newest attempt was a DNF
  const lapsedList = $derived(list.filter(c => {
    const card = store.data.cards[c.id];
    if (!card) return false;
    return (card.fsrs?.lapses ?? 0) > 0 || card.attempts.at(-1)?.pen === 'DNF';
  }).slice(0, 15));
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
    // the weak / lapsed lists are already ordered: take the next one in that order, not the next due
    else if (weak) c = weakList.find(x => x.id !== lastId) ?? weakList[0] ?? null;
    else if (lapsed) c = lapsedList.find(x => x.id !== lastId) ?? lapsedList[0] ?? null;
    else c = pickNext(store.casesFor(set).filter(inScope), store.cardsFor(set), lastId);
    current = c; auf = randomAuf(); lastId = c?.id ?? null;
  }
  function start(isWeak = false, isLapsed = false) { weak = isWeak; lapsed = isLapsed; lastId = null; started = true; sessionStart = Date.now(); next(); }
  // penalties apply to the attempt you just finished
  function togglePen(p: '+2' | 'DNF' | '') {
    if (!current) return;
    if (!p) return;
    const now = store.card(current.id).attempts.at(-1)?.pen;
    store.penAttempt(current.id, now === p ? '' : p);
    result = result ? { ...result } : result;
  }
  function dropAttempt() {
    if (!current) return;
    store.deleteLastAttempt(current.id);
    result = null;
  }
  function end() {
    // close with the numbers for this session rather than an empty Today screen
    summary = sessionStats.n ? {
      n: sessionStats.n,
      best: sessionStats.best,
      avg: (() => {
        const all = Object.values(store.data.cards).flatMap(c => c.attempts).filter(a => a.ts >= sessionStart);
        const ex = all.map(a => a.total - (a.recog ?? 0));
        return ex.length ? ex.reduce((x, y) => x + y, 0) / ex.length : null;
      })(),
    } : null;
    drill = null; started = false;
  }
  function dismissSummary() { summary = null; }
  if (store.focusId) {
    // the Library can ask for one algorithm of a case: pin it, and never fall back to another one
    const id = store.focusId;
    const pin = store.focusAlg && store.algsFor(id).includes(store.focusAlg) ? store.focusAlg : null;
    store.focusAlg = null;
    started = true; next();
    drill = pin; // the case just picked stays pinned to this algorithm until Next
  }

  // how far each set has come: mastered, learning, untouched
  const progress = $derived.by(() => (['PLL', 'OLL', 'F2L', 'ZBLL'] as const).map(setName => {
    const cardList = Object.values(store.cardsFor(setName));
    const mastered = cardList.filter(c => mastery(c) === 'mastered').length;
    const learning = cardList.filter(c => c.seen && mastery(c) !== 'mastered').length;
    return { set: setName, total: cardList.length || 1, mastered, learning, fresh: cardList.length - mastered - learning };
  }));
  // the last 30 days at a glance: how much you practised and how long you were on the clock
  const month = $derived.by(() => {
    const since = Date.now() - 30 * 86400000;
    const solves = store.solves.filter(s => s.ts >= since);
    const timed = solves.filter(s => s.pen !== 'DNF');
    const ms = timed.reduce((n, s) => n + s.ms + (s.pen === '+2' ? 2000 : 0), 0);
    const attempts = Object.values(store.data.cards).flatMap(c => c.attempts).filter(a => a.ts >= since);
    const drillMs = store.data.drills.filter(d => d.ts >= since).reduce((n, d) => n + d.ms, 0);
    const attMs = attempts.reduce((n, a) => n + a.total, 0);
    return {
      solves: solves.length,
      attempts: attempts.length,
      minutes: Math.round((ms + attMs + drillMs) / 60000),
      days: new Set(solves.map(s => new Date(s.ts).toDateString())).size,
    };
  });
  const alg = $derived(current ? (drill ?? store.algFor(current.id)) : '');
  const scramble = $derived(current ? caseScramble(alg, auf, current.set === 'F2L') : '');
  const scrTokens = $derived(scramble.split(/\s+/).filter(Boolean));
  // attempts as execution time; the side panel shows the last five with deltas
  const attempts = $derived(current ? store.card(current.id).attempts : []);
  // what this session has produced so far
  const sessionStats = $derived.by(() => {
    const all = Object.values(store.data.cards).flatMap(c => c.attempts).filter(a => a.ts >= sessionStart);
    const execs = all.map(a => a.total - (a.recog ?? 0));
    return { n: all.length, best: execs.length ? execs.reduce((a, b) => (b < a ? b : a), Infinity) : null };
  });
  const execOf = (a: { total: number; recog: number | null }) => a.total - (a.recog ?? 0);

  // The attempt itself decides the review grade: no self-rating. A DNF, a case you never recognised
  // (no first tap) or a very slow solve is a lapse, which is what the "Lapsed" drill and the
  // optimiser need in order to learn anything from a failure.
  function finish(r: { ms: number; recog: number | null; pen?: Penalty }) {
    if (!current) return;
    const ok = r.pen !== 'DNF' && (drill ? true : r.recog != null);
    store.grade(current.id, gradeForAttempt(r.ms, r.recog, CASE_TARGET_MS[current.set], ok), r.ms, r.recog, drill ?? undefined);
    result = r;
  }
  const typing = (e: Event) => /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
  function onKey(e: KeyboardEvent) {
    if (typing(e)) return;
    if (store.timerRunning) return;   // the timer owns the keyboard while it runs
    // Today screen: A / D switch the case set, S opens the training history, Enter starts
    if (!started && !hist) {
      if (store.is(e, 'trainPrev')) { set = SET_NAMES[(SET_NAMES.indexOf(set) - 1 + SET_NAMES.length) % SET_NAMES.length]; e.preventDefault(); return; }
      if (store.is(e, 'trainNext')) { set = SET_NAMES[(SET_NAMES.indexOf(set) + 1) % SET_NAMES.length]; e.preventDefault(); return; }
      if (store.is(e, 'trainHistory')) { hist = true; e.preventDefault(); return; }
      // Enter is the universal "activate"; the timer command starts a session too, even when rebound
      if ((e.key === 'Enter' || store.is(e, 'timer')) && list.length) { start(); e.preventDefault(); return; }
      return;
    }
    if (!started) return;
    if (store.is(e, 'plus2')) { togglePen('+2'); e.preventDefault(); return; }
    if (store.is(e, 'dnf')) { togglePen('DNF'); e.preventDefault(); return; }
    if (store.is(e, 'deleteLast')) { dropAttempt(); e.preventDefault(); return; }
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

    {#if summary}
      <div class="card" role="status" style="border-color:var(--am);display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:800">Session finished</div>
        <div class="mu">{summary.n} attempt{summary.n === 1 ? '' : 's'} · best {formatTime(summary.best)} · average {formatTime(summary.avg)}</div>
        <button class="btn" style="align-self:flex-start" onclick={dismissSummary}>Done</button>
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

    <div class="card" aria-label="Last 30 days">
      <div class="mu">Last 30 days</div>
      <div class="row" style="margin-top:8px;gap:10px">
        <div style="flex:1"><div class="mono" style="font-weight:800;font-size:1.3rem">{month.solves}</div><div class="mu">solves</div></div>
        <div style="flex:1"><div class="mono" style="font-weight:800;font-size:1.3rem">{month.attempts}</div><div class="mu">training attempts</div></div>
        <div style="flex:1"><div class="mono" style="font-weight:800;font-size:1.3rem">{month.minutes}</div><div class="mu">minutes on the clock</div></div>
        <div style="flex:1"><div class="mono" style="font-weight:800;font-size:1.3rem">{month.days}</div><div class="mu">days practised</div></div>
      </div>
    </div>

    <div class="card" aria-label="Progress by set">
      <div class="mu">Progress</div>
      <div class="col" style="gap:6px;margin-top:8px">
        {#each progress as p (p.set)}
          <div class="row sp prow" style="padding:3px 0">
            <span style="font-weight:700">{p.set}{#if p.set === 'F2L'} <span class="mu pc-only"> · 4 slots</span>{/if}</span>
            <span class="mu mono">{p.mastered} mastered · {p.learning} learning · {p.fresh} new</span>
          </div>
          <div style="height:6px;border-radius:3px;background:#2A303B;overflow:hidden">
            <div style="height:100%;width:{(p.mastered / p.total * 100).toFixed(1)}%;background:var(--good)"></div>
          </div>
        {/each}
      </div>
    </div>

    {#if store.shown('home.drills')}
      <div class="mu">Quick drills</div>
      <div class="col">
        <button class="btn row-btn" disabled={weakList.length === 0} onclick={() => start(true)}>Weak spots, your slowest 10 {set} cases{weakList.length === 0 ? ' (train a few first)' : ''}</button>
        <button class="btn row-btn" disabled={lapsedList.length === 0} onclick={() => start(false, true)}>Lapsed, the {set} cases you got wrong{lapsedList.length === 0 ? ' (none yet)' : ` (${lapsedList.length})`}</button>
        {#each DRILLS as d (d.mode)}<button class="btn row-btn" onclick={() => { nav.drillMode = d.mode; nav.go('drills'); }}>{d.label}</button>{/each}
      </div>
    {/if}
  <ShortcutsSide view="train" />
  </main>
{:else}
  <div class="page wide" style="gap:0">
    <div class="split">
      <main style="display:flex;flex-direction:column;gap:14px">
        <h1 class="sr">Training session</h1>
        <div class="row sp"><span class="chip">{drill && current ? `Algorithm drill · ${current.name}` : `Recognition · ${set}`}{weak ? ' · weak spots' : ''}{lapsed ? ' · lapsed' : ''}{set === 'F2L' && slotFilter !== 'All' ? ` · ${slotFilter}` : ''}</span><button class="btn" onclick={end}>End session</button></div>
        <div class="row sp"><span class="mu">{drill ? 'One algorithm, execution only' : 'Recognition first, then execution'} · {drill ? '' : `${due} due · ${fresh} new`}{#if sessionStats.n} · {sessionStats.n} done{/if}{#if sessionStats.best != null} · best {formatTime(sessionStats.best)}{/if}</span><span class="mu">{current ? mastery(cards[current.id]) : ''}</span></div>

        {#if current}
          <div class="card" style="text-align:center">
            {#if !result}<div class="mu">Scramble</div>{/if}
            <div class="scr" style="margin-top:{result ? 0 : 8}px">{#each scrTokens as t, idx (idx)}<span class:now={idx === walkIndex}>{t}</span>{' '}{/each}</div>
            {#if store.shown('train.cube') && !store.cubeHidden}<div class="cube-panel" style="margin-top:8px;display:flex;justify-content:center"><ScrambleWalk alg={scramble} size={84} autoplay={store.data.settings.walkAutoplay} speed={store.data.settings.walkSpeed} onIndex={(i) => (walkIndex = i)} onClose={() => (store.cubeHidden = true)} /></div>{:else}<button class="btn" style="align-self:center;min-height:0;padding:6px 12px;font-size:.8rem" onclick={() => (store.cubeHidden = false)}>Show the cube</button>{/if}
            {#if !result && store.shown('train.hint')}<div class="mu" style="margin-top:6px">{HINT[set]}{#if set === 'F2L' && current.slot} Solve the <b style="color:var(--tx)">{SLOT_NAMES[current.slot]}</b> pair.{/if}</div>{/if}
          </div>

          <TimerPad twoPress={!drill} holdMs={store.data.settings.holdMs} tapStart={store.data.settings.tapStart} cover={store.data.settings.coverOn} coverColor={store.data.settings.coverColor} onfinish={finish} />
          {#if result}
            <div class="mu" style="text-align:center">
              Last <b class="mono" style="color:var(--tx)">{formatTime(result.ms)}</b>{#if result.recog != null} · recog <b class="mono" style="color:var(--tx)">{formatTime(result.recog)}</b> · exec <b class="mono" style="color:var(--tx)">{formatTime(result.ms - result.recog)}</b>{/if}
              · {current.name}{#if current.nick} ({current.nick}){/if}
            </div>
          {:else}
            <div class="mu" style="text-align:center">{drill ? 'Execution only: hold to start, release to go, then tap to stop.' : 'Press once when you recognise the case, again when you finish.'}</div>
          {/if}
          {#if result && current}
            <PenaltyRow pen={store.card(current.id).attempts.at(-1)?.pen ?? ''} onpen={togglePen} ondelete={dropAttempt} />
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
        {#if current && (result || drill)}
          <div style="display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center">
            <div class="mu">You just did</div>
            <div style="font-weight:800">{current.name}</div>
            {#if current.set === 'F2L'}
              <CaseCube alg={alg} slotId={current.slot} size={72} />
            {:else}
              <CaseDiagram alg={alg} mode={current.set === 'OLL' ? 'oll' : 'pll'} size={96} slot={current.slot} />
            {/if}
          </div>
        {/if}
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
