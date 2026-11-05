<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nav } from '../lib/nav.svelte';
  import { SET_NAMES, SLOTS, F2L_GROUPS, ZBLL_GROUPS, f2lSibling, type CaseSet } from '../lib/data';
  import CaseDiagram from '../lib/ui/CaseDiagram.svelte';
  import CaseCube from '../lib/ui/CaseCube.svelte';
  import CaseThumb from '../lib/ui/CaseThumb.svelte';
  import LazyBox from '../lib/ui/LazyBox.svelte';
  import ShortcutsSide from '../lib/ui/ShortcutsSide.svelte';
  import ScrambleWalk from '../lib/ui/ScrambleWalk.svelte';
  import Deltas from '../lib/ui/Deltas.svelte';
  import TimerPad from '../lib/ui/TimerPad.svelte';
  import { mastery, recall, dueLabel, gradeForAttempt } from '../lib/core/srs';
  import { CASE_TARGET_MS } from '../lib/core/targets';
  import { moveCount, caseScramble, randomAuf } from '../lib/core/alg';
  import { formatTime, attemptExec, mean, type Penalty } from '../lib/core/stats';
  import { makeHints } from '../lib/core/hints';
  import TrainHistory from '../lib/ui/TrainHistory.svelte';
  import PenaltyRow from '../lib/ui/PenaltyRow.svelte';
  import { hoverEnter, hoverLeave } from '../lib/ui/hover';

  let set = $state<CaseSet>('PLL');
  let selId = $state<string | null>(null);
  let draft = $state('');
  let error = $state('');
  let zbllText = $state('');
  let zbllMsg = $state<string[]>([]);
  let groupFilter = $state<string | null>(null);   // F2L group, the grid always shows the front-right set
  // Vimium-style: press F, type a case's code, and that case opens
  let hint = $state(false);
  let typed = $state('');
  let q = $state('');   // filter by name or code, handy for F2L and long ZBLL lists
  let show = $state<'all' | 'new' | 'learning' | 'mastered' | 'due'>('all');
  let visible = $state(12);   // cells rendered right away, the rest follow in idle time
  let confirmReset = $state(false);   // two taps before progress is thrown away
  let hist = $state(false);
  let walkIndex = $state(0);

  // Learning a case happens here, in the Library, with the same session layout as Train but no recognition timing.
  let training = $state<{ id: string; alg: string } | null>(null);
  let auf = $state('');
  let result = $state<{ ms: number; recog: number | null } | null>(null);

  const matches = (c: { name: string; id: string }) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const code = codesRaw.get(c.id) ?? '';
    return c.name.toLowerCase().includes(needle) || code.includes(needle);
  };
  const keep = (c: { id: string }) => {
    const k = store.card(c.id);
    if (show === 'new') return !k.seen;
    if (show === 'learning') return k.seen && mastery(k) !== 'mastered';
    if (show === 'mastered') return mastery(k) === 'mastered';
    if (show === 'due') return k.seen && k.due <= store.now;
    return true;
  };
  // the F2L grid shows the front-right slot only; ZBLL filters by subset and F2L by pair group
  const inScope = (c: { slot?: string; group?: string }) =>
    set === 'F2L' ? c.slot === 'FR' && (!groupFilter || c.group === groupFilter) : !groupFilter || c.group === groupFilter;
  const list = $derived(store.casesFor(set).filter(c => inScope(c) && matches(c) && keep(c)));
  const shownList = $derived(list.slice(0, visible));
  // the group chips belong to one set's numbering, so a set change drops the filter
  let lastSet: CaseSet | '' = '';
  $effect(() => {
    if (set === lastSet) return;
    lastSet = set;
    groupFilter = null;
  });
  // a different set or filter starts from a short list again
  let lastFilters = '';
  $effect(() => {
    const key = `${set}|${groupFilter}|${q}|${show}`;
    if (key === lastFilters) return;
    lastFilters = key;
    visible = 12;
  });
  // grow the grid a few cells at a time while the browser is idle, so switching is instant
  $effect(() => {
    const total = list.length;
    if (visible >= total) return;
    const idle = (window as any).requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 120));
    let stop = false;
    const grow = () => {
      if (stop || visible >= total) return;
      visible = Math.min(total, visible + 12);
      if (visible < total) idle(grow);
    };
    idle(grow);
    return () => { stop = true; };
  });
  const mode = $derived(set === 'F2L' ? 'f2l' : set === 'OLL' ? 'oll' : 'pll');
  // looked up in the whole set, not in the filtered list: the slot tabs open a sibling case
  // (F2L 1 in FL) that the current grid filter does not contain, and it must still open
  const sel = $derived(selId ? store.casesFor(set).find(c => c.id === selId) ?? null : null);
  const card = $derived(sel ? store.card(sel.id) : null);
  const algs = $derived(sel ? store.algsFor(sel.id) : []);
  const current = $derived(sel ? store.algFor(sel.id) : '');
  const short = (n: string) => n.replace('-perm', '').replace('OLL ', '').replace('F2L ', '').replace('ZBLL ', '');
  // OLL cells show the case name ("Sune"), not just its number; the number is still in the panel
  const label = (c: { name: string; nick?: string }) => (set === 'OLL' ? (c.nick ?? c.name) : short(c.name));

  const tCase = $derived(training ? store.caseOf(training.id) : null);
  const tAlg = $derived(training?.alg ?? '');
  const tScramble = $derived(training && tCase ? caseScramble(training.alg, auf, tCase.set === 'F2L') : '');
  const tMode = $derived(tCase ? (tCase.set === 'F2L' ? 'f2l' : tCase.set === 'OLL' ? 'oll' : 'pll') : 'pll');
  const tAttempts = $derived(training ? store.card(training.id).attempts : []);
  const tExec = (a: { total: number; recog: number | null; pen?: '+2' | 'DNF' }) => attemptExec(a);

  function stats(alg?: string) {
    const a = (card?.attempts ?? []).filter(x => x.recog != null && (!alg || (x.alg ?? store.caseOf(sel!.id).alg) === alg));
    // a penalty has to move these numbers: a DNF attempt has no usable execution time
    return { n: a.length, recog: mean(a.map(x => x.recog!)), exec: mean(a.map(tExec).filter(Number.isFinite)) };
  }
  function pick(id: string) {
    selId = id; draft = ''; error = ''; confirmReset = false;
    // the case panel sits under the grid: bring it into view instead of making you scroll
    requestAnimationFrame(() => {
      const el = document.getElementById('case-panel');
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight - 120 || r.bottom < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function add() {
    if (!sel) return;
    const err = store.addAlg(sel.id, draft);
    error = err ?? '';
    if (!err) draft = '';
  }
  function importZbll() {
    const r = store.importZbll(zbllText);
    const parts: string[] = [];
    if (r.attached) parts.push(`${r.attached} algorithm${r.attached === 1 ? '' : 's'} added to ZBLL cases`);
    if (r.added) parts.push(`${r.added} new case${r.added === 1 ? '' : 's'}`);
    zbllMsg = [parts.length ? `${parts.join(' · ')}.` : 'Nothing to import.', ...r.errors.slice(0, 8), ...(r.errors.length > 8 ? [`…and ${r.errors.length - 8} more problems`] : [])];
    if (!r.errors.length) zbllText = '';
  }
  const hasOwnZbll = $derived(store.data.zbll.length > 0 || store.casesFor('ZBLL').some(c => (store.data.cards[c.id]?.algs?.length ?? 0) > 0));
  // Back closes the learner first, then the open case, then leaves the tab
  $effect(() => {
    if (training) return nav.onBack(() => { endTraining(); return true; });
    if (selId) return nav.onBack(() => { selId = null; return true; });
  });
  const mastered = $derived(list.reduce((n, c) => n + (mastery(store.card(c.id)) === 'mastered' ? 1 : 0), 0));
  const groupCounts = $derived.by(() => {
    if (set === 'ZBLL') {
      return ZBLL_GROUPS.map(name => {
        const cs = store.casesFor('ZBLL').filter(c => c.group === name);
        return { name, total: cs.length, done: cs.filter(c => mastery(store.card(c.id)) === 'mastered').length };
      });
    }
    const fr = store.casesFor('F2L').filter(c => c.slot === 'FR');
    // speedcubedb lists its filters alphabetically, with the same six groups and the same totals
    return [...F2L_GROUPS].sort((a, b) => a.localeCompare(b)).map(name => {
      const cs = fr.filter(c => c.group === name);
      return { name, total: cs.length, done: cs.filter(c => mastery(store.card(c.id)) === 'mastered').length };
    });
  });
  const learning = $derived(list.reduce((n, c) => { const m = mastery(store.card(c.id)); return n + (m === 'learning' ? 1 : 0); }, 0));
  const dueNow = $derived(list.filter(c => { const k = store.card(c.id); return k.seen && k.due <= store.now; }).length);
  const codesRaw = $derived(makeHints(store.casesFor(set).filter(inScope).map(c => ({ id: c.id, name: c.name }))));
  const codes = $derived(makeHints(list.map(c => ({ id: c.id, name: c.name }))));
  // while the codes are up, the tab keys are part of the code, not navigation
  $effect(() => { nav.hintActive = hint; return () => { nav.hintActive = false; }; });
  const shownCode = (c: { id: string }) => codes.get(c.id) ?? '';
  // while the codes are up, typing can also spell a case name or nickname
  const named = (c: { name: string; nick?: string }) => `${short(c.name)} ${c.nick ?? ''}`.toLowerCase();
  // exact name first, then a name that starts with what was typed, then any word inside it
  const nameScore = (c: { name: string; nick?: string }, needle: string) => {
    const nick = (c.nick ?? '').toLowerCase(), nm = short(c.name).toLowerCase();
    if (nick === needle || nm === needle) return 3;
    if (nick.startsWith(needle) || nm.startsWith(needle)) return 2;
    return 1;
  };
  const byName = (needle: string) =>
    list.filter(c => named(c).split(/[\s'-]+/).some(w => w.startsWith(needle)))
      .sort((a, b) => nameScore(b, needle) - nameScore(a, needle));
  // once per keystroke, not once per cell: the grid asked byName() inside its own {#each}, which is
  // a filter plus a sort over the whole set for every one of the 472 cells
  const nameMatches = $derived(hint && typed ? byName(typed) : []);

  function startTraining(id: string) {
    training = { id, alg: store.algFor(id) };
    auf = randomAuf();
    result = null;
  }
  function trainCase() { if (sel) startTraining(sel.id); }
  function nextScramble() { auf = randomAuf(); result = null; }
  function togglePen(p: '+2' | 'DNF' | '') {
    if (!training || !p) return;
    const now = store.card(training.id).attempts.at(-1)?.pen;
    store.penAttempt(training.id, now === p ? '' : p);
    result = result ? { ...result } : result;
  }
  function dropAttempt() {
    if (!training) return;
    store.deleteLastAttempt(training.id);
    result = null;
  }
  function endTraining() { training = null; result = null; }
  function finish(r: { ms: number; recog: number | null; pen?: Penalty }) {
    if (!training) return;
    // no recognition tap here, so the time itself is what the grade is based on
    const target = CASE_TARGET_MS[store.caseOf(training.id).set];
    store.grade(training.id, gradeForAttempt(r.ms, r.recog, target, r.pen !== 'DNF'), r.ms, r.recog, training.alg);
    result = r;
  }
  function stepSet(step: number) {
    const i = SET_NAMES.indexOf(set);
    set = SET_NAMES[(i + step + SET_NAMES.length) % SET_NAMES.length];
    selId = null;
  }
  function onKey(e: KeyboardEvent) {
    const inField = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
    // Esc must still work from the search box: clear the query, or close an open case panel
    if (inField) {
      if (e.key === 'Escape') {
        if (q) { q = ''; e.preventDefault(); return; }
        if (selId) { selId = null; e.preventDefault(); return; }
      }
      return;
    }
    if (store.timerRunning) return;   // the timer owns the keyboard while it runs
    if (training) {
      // the learner owns the arrows; penalties work like on the timer
      if (store.is(e, 'plus2')) { togglePen('+2'); e.preventDefault(); return; }
      if (store.is(e, 'dnf')) { togglePen('DNF'); e.preventDefault(); return; }
      if (store.is(e, 'deleteLast')) { dropAttempt(); e.preventDefault(); return; }
      return;
    }
    if (!hint && q && e.key === 'Escape') { q = ''; e.preventDefault(); return; }
    if (!hint && store.is(e, 'libPrev')) { stepSet(-1); e.preventDefault(); e.stopPropagation(); return; }
    if (!hint && store.is(e, 'libNext')) { stepSet(1); e.preventDefault(); e.stopPropagation(); return; }
    if (!hint && (e.key === 'Enter' || store.is(e, 'timer')) && selId) { e.preventDefault(); trainCase(); return; }
    if (!hint) {
      if (store.is(e, 'hints') && list.length) { hint = true; typed = ''; e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (e.key === 'Enter') {
      const exactCode = [...codes].find(([, code]) => code === typed)?.[0];
      const cand = exactCode ?? byName(typed)[0] ?? [...codes].find(([, code]) => code.startsWith(typed))?.[0];
      if (cand) pick(typeof cand === 'string' ? cand : cand.id);
      hint = false; typed = ''; e.preventDefault(); e.stopPropagation(); return;
    }
    if (e.key === 'Escape') { hint = false; typed = ''; e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'Backspace') { typed = typed.slice(0, -1); e.preventDefault(); e.stopPropagation(); return; }
    const ch = e.key.toLowerCase();
    if (!/^[a-z0-9]$/.test(ch)) { hint = false; typed = ''; return; }
    const next = typed + ch;
    const hit = [...codes].find(([, code]) => code === next);
    const names = byName(next);
    // a single key is ambiguous: it may be a one-letter code or the start of a name, so it narrows
    if (hit && names.length === 0 && next.length >= 2) { pick(hit[0]); hint = false; typed = ''; e.preventDefault(); e.stopPropagation(); return; }
    const codeAlive = [...codes.values()].some(code => code.startsWith(next));
    // open as soon as one name is clearly ahead: an exact match, or nothing tying with it
    const clear = names.length > 0 && nameScore(names[0], next) > (names[1] ? nameScore(names[1], next) : -1);
    if (clear) { pick(names[0].id); hint = false; typed = ''; e.preventDefault(); e.stopPropagation(); return; }
    if (codeAlive || names.length) { typed = next; e.preventDefault(); e.stopPropagation(); return; }
    // a key that matches nothing is ignored: a typo should not throw you out of the overlay
    e.preventDefault();
  }
</script>

<svelte:window onkeydowncapture={onKey} />

{#if hist}
  <TrainHistory caseId={selId} onBack={() => (hist = false)} />
{:else}
<main class="page wide">
  <div class="split"><div class="col" style="gap:12px">
  {#if training && tCase}
    <div class="row sp">
      <span class="chip">Library · {tCase.name}{#if tCase.nick} · {tCase.nick}{/if}</span>
      <button class="btn" onclick={endTraining}>End</button>
    </div>
    <div class="row sp"><span class="mu">{mastery(store.card(tCase.id))}</span></div>

    <div class="card" style="display:flex;gap:10px;align-items:center;padding:10px 12px">
      <div style="flex:none">{#if tCase.set === 'F2L'}<CaseCube alg={tAlg} slotId={tCase.slot} size={70} />{:else}<CaseDiagram alg={tAlg} mode={tMode} size={82} slot={tCase.slot} />{/if}</div>
      <div class="mono" style="word-break:break-word;font-size:.8rem;line-height:1.4">{tAlg}</div>
    </div>

    <div class="card" style="display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center">
      <div class="scr">{#each tScramble.split(/\s+/).filter(Boolean) as t, idx (idx)}<span class:now={idx === walkIndex}>{t}</span> {/each}</div>
      {#if store.shown('solve.cube') && !store.cubeHidden}<div class="cube-panel"><ScrambleWalk alg={tScramble} autoplay={store.data.settings.walkAutoplay} speed={store.data.settings.walkSpeed} onIndex={(i) => (walkIndex = i)} onClose={() => (store.cubeHidden = true)} /></div>{:else}<button class="btn" style="min-height:0;padding:6px 12px;font-size:.8rem" onclick={() => (store.cubeHidden = false)}>Show the cube</button>{/if}
    </div>

    <TimerPad holdMs={store.data.settings.holdMs} tapStart={store.data.settings.tapStart} cover={store.data.settings.coverOn} coverColor={store.data.settings.coverColor} onfinish={finish} />
    {#if result}
      <div class="mu" style="text-align:center">Last <b class="mono" style="color:var(--tx)">{formatTime(result.ms)}</b></div>
      {#if training}<PenaltyRow pen={store.card(training.id).attempts.at(-1)?.pen ?? ''} onpen={togglePen} ondelete={dropAttempt} />{/if}
    {:else}
      <div class="mu" style="text-align:center">Hold to start, tap to stop.</div>
    {/if}
    <div class="row"><button class="btn p" onclick={nextScramble}>Next scramble</button></div>

    <div class="card"><Deltas times={tAttempts.map(tExec)} title="Recent attempts on this case" /></div>
  {:else}
    <div class="row sp"><h1>Library</h1><button class="btn" onclick={() => (hist = true)}>History</button></div>
    <div class="seg" role="group" aria-label="Case set">
      {#each SET_NAMES as s (s)}
        <button class:on={set === s} onclick={() => { set = s; selId = null; }} onpointerenter={() => hoverEnter(() => { set = s; selId = null; })} onpointerleave={hoverLeave}>{s}</button>
      {/each}
    </div>

    {#if hint && typed}
      <div class="mu" role="status" aria-live="polite">“{typed}” · {nameMatches.length + [...codes.values()].filter(code => code.startsWith(typed)).length} match · Enter opens the first</div>
    {/if}
    {#if hint}<div class="sr" role="status" aria-live="polite">Case codes shown. Type a code, or the start of a case name, to open it. Escape closes this.</div>{/if}
    {#if set === 'F2L' || set === 'ZBLL'}
      <div class="seg groups" role="group" aria-label="{set} group">
        <button class:on={!groupFilter} aria-pressed={!groupFilter} aria-label="All groups" onclick={() => { groupFilter = null; selId = null; }}>
          <span>All groups</span><span class="mu">{groupCounts.reduce((a, g) => a + g.done, 0)}/{groupCounts.reduce((a, g) => a + g.total, 0)}</span>
        </button>
        {#each groupCounts as g (g.name)}
          <button class:on={groupFilter === g.name} aria-pressed={groupFilter === g.name} aria-label="{g.name}, {g.done} of {g.total} mastered" onclick={() => { groupFilter = g.name; selId = null; }}>
            <span>{g.name}</span><span class="mu">{g.done}/{g.total}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if set === 'ZBLL'}
      <div class="card" style="display:flex;flex-direction:column;gap:8px">
        <div style="font-weight:800">Your own ZBLL algorithms</div>
        <div class="mu">All 472 ZBLL cases ship with the app. Paste your own list to swap in your algorithms: one <span class="mono">name: algorithm</span> or bare algorithm per line. A line that names a case (<span class="mono">U1</span>, <span class="mono">T 4</span>) or solves one adds your algorithm to it; anything else becomes its own case. Each line is checked by the cube simulator: F2L solved and edges oriented.</div>
        <label class="sr" for="zb">ZBLL algorithms</label>
        <textarea id="zb" rows="5" placeholder="T 1: R U R' U' R' F R2 U' R' U' R U R' F' ..." bind:value={zbllText}></textarea>
        <div class="row"><button class="btn p" onclick={importZbll}>Import</button>{#if hasOwnZbll}<button class="btn" onclick={() => { if (confirm('Remove the ZBLL algorithms you imported and any you added to bundled cases?')) { store.clearZbll(); selId = null; } }}>Remove mine</button>{/if}</div>
        {#each zbllMsg as m, i (i)}<div class="mu" role="status">{m}</div>{/each}
      </div>
    {/if}

    <div class="seg" role="group" aria-label="Filter by progress">
      {#each [['all', 'All'], ['new', 'New'], ['learning', 'Learning'], ['mastered', 'Mastered'], ['due', 'Due']] as [v, l] (v)}
        <button class:on={show === v} aria-pressed={show === v} onclick={() => (show = v as typeof show)}>{l}</button>
      {/each}
    </div>
    <input placeholder="Search a case (name or code)"  value={q} oninput={(e) => (q = e.currentTarget.value)} aria-label="Search cases" style="max-width:320px" />
    {#if list.length}
      <div class="mu">{mastered} mastered · {learning} learning · {list.length - mastered - learning} new{#if dueNow} · {dueNow} due now{/if}</div>
      <div class="grid">
        {#each shownList as c (c.id)}
          {@const m = mastery(store.card(c.id))}
          {@const code = shownCode(c)}
          <button class="cell {m}" class:sel={selId === c.id} class:dim={hint && typed.length > 0 && !code.startsWith(typed) && !nameMatches.includes(c)} onclick={() => pick(c.id)} aria-label="{c.name}, {m}">
            {#if set === 'F2L'}
              <LazyBox width={81} height={76}><CaseThumb alg={store.algFor(c.id)} slotId={c.slot} size={54} /></LazyBox>
            {:else}
              <CaseDiagram alg={store.algFor(c.id)} {mode} size={64} slot={c.slot} />
            {/if}
            <span class="clabel" title="{c.name}{c.nick ? ` · ${c.nick}` : ''}">{label(c)}</span>
            {#if hint}<span class="hint" aria-hidden="true">{typed && code.startsWith(typed) ? code.slice(typed.length) : code}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if sel && card}
      <div class="card" id="case-panel" style="display:flex;flex-direction:column;gap:10px">
        {#if set === 'F2L' && sel.slot}
          <div class="seg" role="group" aria-label="Slot for this case">
            {#each SLOTS as sl (sl)}
              <button class:on={sel.slot === sl} aria-pressed={sel.slot === sl} onclick={() => (selId = f2lSibling(sel.id, sl))}>{sl}</button>
            {/each}
          </div>
        {/if}
        <div class="row" style="gap:14px">
          <div style="flex:none">{#if set === 'F2L'}<CaseCube alg={current} slotId={sel.slot} size={92} />{:else}<CaseDiagram alg={current} {mode} size={110} slot={sel.slot} />{/if}</div>
          <div>
            <div style="font-size:1.4rem;font-weight:800">{sel.name}{#if sel.nick} <span style="color:var(--am)">{sel.nick}</span>{/if}</div>
            {#if sel.group}<div class="mu">{sel.group}</div>{/if}
            <div class="mu">{mastery(card)} · {card.attempts.length} attempts</div>
            <div class="mu">Recog {formatTime(stats().recog)} · Exec {formatTime(stats().exec)}</div>
            <div class="mu">Next review {dueLabel(card, store.now)}{#if recall(card, store.now, store.data.settings.retention, store.data.settings.fsrsW) != null} · recall ≈ {Math.round(recall(card, store.now, store.data.settings.retention, store.data.settings.fsrsW)! * 100)}%{/if}</div>
          </div>
        </div>

        <div class="mu">Algorithms · tap one to make it your default</div>
        <div role="radiogroup" aria-label="Default algorithm" style="display:flex;flex-direction:column;gap:8px">
          {#each algs as a, i (a)}
            {@const st = stats(a)}
            {@const shipped = store.isBundled(sel.id, a)}
            <div class="row" style="gap:6px;align-items:stretch">
              <button role="radio" aria-checked={a === current} class="btn" class:on={a === current} style="flex:1;text-align:left;padding:10px 12px;display:flex;flex-direction:column;gap:4px" onclick={() => store.setDefault(sel.id, a)}>
                <span class="mono" style="font-size:.9rem;word-break:break-word">{a}</span>
                <span class="mu">{a === current ? 'Default · ' : ''}{shipped ? 'built-in' : 'yours'} · {moveCount(a)} moves{st.n ? ` · exec ${formatTime(st.exec)} (${st.n})` : ''}</span>
              </button>
              {#if i > 0 && !shipped}<button class="btn" style="flex:none" aria-label="Remove algorithm" onclick={() => store.removeAlg(sel.id, a)}>✕</button>{/if}
            </div>
          {/each}
        </div>

        <label class="mu" for="newalg">Add your own algorithm</label>
        <input id="newalg" placeholder="e.g. R U R' U' ..." bind:value={draft} onkeydown={(e) => { if (e.key === 'Enter') add(); }} />
        {#if error}<div role="alert" style="color:#FF8A80;font-weight:700">{error}</div>{/if}
        <button class="btn p" onclick={add}>Add algorithm</button>
        <button class="btn" onclick={trainCase}>Train this case<span class="pc-only"> (Enter)</span></button>
        {#if !confirmReset}
          <button class="btn" style="font-size:.85rem;opacity:.85" onclick={() => (confirmReset = true)}>Reset progress on this case</button>
        {:else}
          <div class="row" style="gap:8px">
            <button class="btn" style="flex:1;border-color:#FF6B6B;color:#FF8A80" onclick={() => { store.resetCard(sel.id); confirmReset = false; }}>Really reset</button>
            <button class="btn" style="flex:1" onclick={() => (confirmReset = false)}>Keep it</button>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
  </div>
  <aside class="side" aria-label="Case panel">
    {#if sel}
      <Deltas times={store.card(sel.id).attempts.map(tExec)} title="Recent attempts on this case" />
    {:else}
      <div class="mu">Open a case to see its attempts here.</div>
    {/if}
    <ShortcutsSide view="lib" inline />
  </aside></div>
</main>
{/if}

<style>
  /* group chips: the name on top, mastered/total under it, wide enough not to truncate */
  .seg.groups button { flex: 1 1 132px; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1px; padding: 6px 8px; line-height: 1.15; white-space: normal; }
  .seg.groups button .mu { font-size: .7rem; }
  .seg.groups button.on .mu { color: var(--on-am); }
</style>
