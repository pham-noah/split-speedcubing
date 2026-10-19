<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nav } from '../lib/nav.svelte';
  import { SET_NAMES, SLOTS, type CaseSet, type Slot } from '../lib/data';
  import CaseDiagram from '../lib/ui/CaseDiagram.svelte';
  import CaseCube from '../lib/ui/CaseCube.svelte';
  import LazyBox from '../lib/ui/LazyBox.svelte';
  import SlotPicker from '../lib/ui/SlotPicker.svelte';
  import ShortcutsSide from '../lib/ui/ShortcutsSide.svelte';
  import ScrambleWalk from '../lib/ui/ScrambleWalk.svelte';
  import Deltas from '../lib/ui/Deltas.svelte';
  import TimerPad from '../lib/ui/TimerPad.svelte';
  import { mastery, recall, dueLabel } from '../lib/core/srs';
  import { moveCount, caseScramble, randomAuf } from '../lib/core/alg';
  import { formatTime } from '../lib/core/stats';
  import { makeHints } from '../lib/core/hints';
  import TrainHistory from '../lib/ui/TrainHistory.svelte';
  import { hoverEnter, hoverLeave } from '../lib/ui/hover';

  let set = $state<CaseSet>('PLL');
  let selId = $state<string | null>(null);
  let draft = $state('');
  let error = $state('');
  let zbllText = $state('');
  let zbllMsg = $state<string[]>([]);
  let slotFilter = $state<Slot>('FR');
  // Vimium-style: press F, type a case's code, and that case opens
  let hint = $state(false);
  let typed = $state('');
  let q = $state('');   // filter by name or code, handy for F2L and long ZBLL lists
  let show = $state<'all' | 'new' | 'learning' | 'mastered' | 'due'>('all');
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
    if (show === 'due') return k.seen && k.due <= Date.now();
    return true;
  };
  const list = $derived(store.casesFor(set).filter(c => (set !== 'F2L' || c.slot === slotFilter) && matches(c) && keep(c)));
  const mode = $derived(set === 'F2L' ? 'f2l' : set === 'OLL' ? 'oll' : 'pll');
  const sel = $derived(selId ? list.find(c => c.id === selId) ?? null : null);
  const card = $derived(sel ? store.card(sel.id) : null);
  const algs = $derived(sel ? store.algsFor(sel.id) : []);
  const current = $derived(sel ? store.algFor(sel.id) : '');
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const short = (n: string) => n.replace('-perm', '').replace('OLL ', '').replace('F2L ', '').replace('ZBLL ', '');

  // the case being learned
  const tCase = $derived(training ? store.caseOf(training.id) : null);
  const tAlg = $derived(training?.alg ?? '');
  const tScramble = $derived(training && tCase ? caseScramble(training.alg, auf, tCase.set === 'F2L') : '');
  const tMode = $derived(tCase ? (tCase.set === 'F2L' ? 'f2l' : tCase.set === 'OLL' ? 'oll' : 'pll') : 'pll');
  const tAttempts = $derived(training ? store.card(training.id).attempts : []);
  const tExec = (a: { total: number; recog: number | null }) => a.total - (a.recog ?? 0);

  function stats(alg?: string) {
    const a = (card?.attempts ?? []).filter(x => x.recog != null && (!alg || (x.alg ?? store.caseOf(sel!.id).alg) === alg));
    return { n: a.length, recog: mean(a.map(x => x.recog!)), exec: mean(a.map(x => x.total - x.recog!)) };
  }
  function pick(id: string) { selId = id; draft = ''; error = ''; }
  function add() {
    if (!sel) return;
    const err = store.addAlg(sel.id, draft);
    error = err ?? '';
    if (!err) draft = '';
  }
  function importZbll() {
    const r = store.importZbll(zbllText);
    zbllMsg = [`${r.added} case${r.added === 1 ? '' : 's'} added.`, ...r.errors.slice(0, 8), ...(r.errors.length > 8 ? [`…and ${r.errors.length - 8} more problems`] : [])];
    if (!r.errors.length) zbllText = '';
  }
  // Back closes the learner first, then the open case, then leaves the tab
  $effect(() => {
    if (training) return nav.onBack(() => { endTraining(); return true; });
    if (selId) return nav.onBack(() => { selId = null; return true; });
  });
  const mastered = $derived(list.reduce((n, c) => n + (mastery(store.card(c.id)) === 'mastered' ? 1 : 0), 0));
  const learning = $derived(list.reduce((n, c) => { const m = mastery(store.card(c.id)); return n + (m === 'learning' ? 1 : 0); }, 0));
  const dueNow = $derived(list.filter(c => { const k = store.card(c.id); return k.seen && k.due <= Date.now(); }).length);
  const codesRaw = $derived(makeHints(store.casesFor(set).filter(c => set !== 'F2L' || c.slot === slotFilter).map(c => ({ id: c.id, name: c.name }))));
  const codes = $derived(makeHints(list.map(c => ({ id: c.id, name: c.name }))));
  // while the codes are up, the tab keys are part of the code, not navigation
  $effect(() => { nav.hintActive = hint; return () => { nav.hintActive = false; }; });
  const shownCode = (c: { id: string }) => codes.get(c.id) ?? '';

  function startTraining(id: string) {
    training = { id, alg: store.algFor(id) };
    auf = randomAuf();
    result = null;
  }
  function trainCase() { if (sel) startTraining(sel.id); }
  function nextScramble() { auf = randomAuf(); result = null; }
  function endTraining() { training = null; result = null; }
  function finish(r: { ms: number; recog: number | null }) {
    if (!training) return;
    store.grade(training.id, 2, r.ms, r.recog, training.alg);
    result = r;
  }
  function stepSet(step: number) {
    const i = SET_NAMES.indexOf(set);
    set = SET_NAMES[(i + step + SET_NAMES.length) % SET_NAMES.length];
    selId = null;
  }
  function onKey(e: KeyboardEvent) {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
    if (training) {
      return;                        // the learner owns the arrows and the keys
    }
    if (!hint && q && e.key === 'Escape') { q = ''; e.preventDefault(); return; }
    if (!hint && store.is(e, 'libPrev')) { stepSet(-1); e.preventDefault(); e.stopPropagation(); return; }
    if (!hint && store.is(e, 'libNext')) { stepSet(1); e.preventDefault(); e.stopPropagation(); return; }
    if (!hint && e.key === 'Enter' && selId) { e.preventDefault(); trainCase(); return; }
    if (!hint) {
      if (store.is(e, 'hints') && list.length) { hint = true; typed = ''; e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (e.key === 'Escape') { hint = false; typed = ''; e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'Backspace') { typed = typed.slice(0, -1); e.preventDefault(); e.stopPropagation(); return; }
    const ch = e.key.toLowerCase();
    if (!/^[a-z0-9]$/.test(ch)) { hint = false; typed = ''; return; }
    const next = typed + ch;
    const hit = [...codes].find(([, code]) => code === next);
    if (hit) { pick(hit[0]); hint = false; typed = ''; e.preventDefault(); e.stopPropagation(); return; }
    if ([...codes.values()].some(code => code.startsWith(next))) { typed = next; e.preventDefault(); e.stopPropagation(); return; }
    hint = false; typed = '';
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

    <TimerPad holdMs={store.data.settings.holdMs} cover={store.data.settings.coverOn} coverColor={store.data.settings.coverColor} onfinish={finish} />
    {#if result}
      <div class="mu" style="text-align:center">Last <b class="mono" style="color:var(--tx)">{formatTime(result.ms)}</b></div>
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

    {#if hint}<div class="sr" role="status" aria-live="polite">Case codes shown. Type a code to open that case. Escape closes this.</div>{/if}
    {#if set === 'F2L'}
      <SlotPicker value={slotFilter} onpick={(s) => { slotFilter = s; selId = null; }} />
    {/if}

    {#if set === 'ZBLL'}
      <div class="card" style="display:flex;flex-direction:column;gap:8px">
        <div style="font-weight:800">Import your ZBLL algorithms</div>
        <div class="mu">No ZBLL algorithms are bundled (there are 493 cases). Paste your own list, one per line, as <span class="mono">name: algorithm</span> or just the algorithm. Each line is checked by the cube simulator: F2L solved and edges oriented.</div>
        <label class="sr" for="zb">ZBLL algorithms</label>
        <textarea id="zb" rows="5" placeholder="Sune + T 1: R U R' U R U2 R' ..." bind:value={zbllText}></textarea>
        <div class="row"><button class="btn p" onclick={importZbll}>Import</button>{#if list.length}<button class="btn" onclick={() => { if (confirm('Remove all imported ZBLL cases and their progress?')) { store.clearZbll(); selId = null; } }}>Remove all</button>{/if}</div>
        {#each zbllMsg as m}<div class="mu" role="status">{m}</div>{/each}
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
        {#each list as c (c.id)}
          {@const m = mastery(store.card(c.id))}
          {@const code = shownCode(c)}
          <button class="cell {m}" class:sel={selId === c.id} class:dim={hint && typed.length > 0 && !code.startsWith(typed)} onclick={() => pick(c.id)} aria-label="{c.name}, {m}">
            {#if set === 'F2L'}
              <LazyBox width={81} height={76}><CaseCube alg={store.algFor(c.id)} slotId={c.slot} size={54} /></LazyBox>
            {:else}
              <CaseDiagram alg={store.algFor(c.id)} {mode} size={64} slot={c.slot} />
            {/if}
            <span>{short(c.name)}</span>
            {#if hint}<span class="hint" aria-hidden="true">{typed && code.startsWith(typed) ? code.slice(typed.length) : code}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if sel && card}
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <div class="row" style="gap:14px">
          <div style="flex:none">{#if set === 'F2L'}<CaseCube alg={current} slotId={sel.slot} size={92} />{:else}<CaseDiagram alg={current} {mode} size={110} slot={sel.slot} />{/if}</div>
          <div>
            <div style="font-size:1.4rem;font-weight:800">{sel.name}{#if sel.nick} <span style="color:var(--am)">{sel.nick}</span>{/if}</div>
            {#if sel.group}<div class="mu">{sel.group}</div>{/if}
            <div class="mu">{mastery(card)} · {card.attempts.length} attempts</div>
            <div class="mu">Recog {formatTime(stats().recog)} · Exec {formatTime(stats().exec)}</div>
            <div class="mu">Next review {dueLabel(card)}{#if recall(card, Date.now(), store.data.settings.retention, store.data.settings.fsrsW) != null} · recall ≈ {Math.round(recall(card, Date.now(), store.data.settings.retention, store.data.settings.fsrsW)! * 100)}%{/if}</div>
          </div>
        </div>

        <div class="mu">Algorithms · tap one to make it your default</div>
        <div role="radiogroup" aria-label="Default algorithm" style="display:flex;flex-direction:column;gap:8px">
          {#each algs as a, i (a)}
            {@const st = stats(a)}
            <div class="row" style="gap:6px;align-items:stretch">
              <button role="radio" aria-checked={a === current} class="btn" class:on={a === current} style="flex:1;text-align:left;padding:10px 12px;display:flex;flex-direction:column;gap:4px" onclick={() => store.setDefault(sel.id, a)}>
                <span class="mono" style="font-size:.9rem;word-break:break-word">{a}</span>
                <span class="mu">{a === current ? 'Default · ' : ''}{i === 0 ? (set === 'ZBLL' ? 'imported' : 'built-in') : 'yours'} · {moveCount(a)} moves{st.n ? ` · exec ${formatTime(st.exec)} (${st.n})` : ''}</span>
              </button>
              {#if i > 0}<button class="btn" style="flex:none" aria-label="Remove algorithm" onclick={() => store.removeAlg(sel.id, a)}>✕</button>{/if}
            </div>
          {/each}
        </div>

        <label class="mu" for="newalg">Add your own algorithm</label>
        <input id="newalg" placeholder="e.g. R U R' U' ..." bind:value={draft} onkeydown={(e) => { if (e.key === 'Enter') add(); }} />
        {#if error}<div role="alert" style="color:#FF8A80;font-weight:700">{error}</div>{/if}
        <button class="btn p" onclick={add}>Add algorithm</button>
        <button class="btn" onclick={trainCase}>Train this case<span class="pc-only"> (Enter)</span></button>
      </div>
    {/if}
  {/if}
  </div>
  <aside class="side" aria-label="Case panel">
    {#if sel}
      <Deltas times={store.card(sel.id).attempts.map(x => x.total - (x.recog ?? 0))} title="Recent attempts on this case" />
    {:else}
      <div class="mu">Open a case to see its attempts here.</div>
    {/if}
    <ShortcutsSide view="lib" inline />
  </aside></div>
</main>
{/if}
