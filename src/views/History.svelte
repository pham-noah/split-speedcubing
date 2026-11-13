<script lang="ts">
  import { store } from '../lib/store.svelte';
  import {
    averageOf, bestAverage, best, effective, formatTime, mean, phaseLabels, phaseMeans, runningAverage, stdDev,
  } from '../lib/core/stats';
  import ShortcutsSide from '../lib/ui/ShortcutsSide.svelte';
  const { onBack }: { onBack: () => void } = $props();

  // Escape goes back; so does the "New scramble" key (S by default), which is how S has always worked here
  function onKey(e: KeyboardEvent) {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
    if (store.is(e, 'back') || store.is(e, 'scramble')) {
      e.preventDefault();
      onBack();
    }
  }
  const solves = $derived(store.solves);
  // A page of rows at a time, so a history of 50 000 solves is browsable without ever building 50 000
  // rows: the deltas only have to cover the rows on screen plus the 11 before them that their ao12
  // windows reach back into. Over the whole session that cost 43 ms at 50 000 solves, for numbers no
  // row on screen ever reads.
  const PAGE = 200;
  let limit = $state(PAGE);
  const list = $derived([...solves].reverse().slice(0, limit));
  // the finished times of this session, and the per-phase means once splits exist
  const times = $derived(solves.map(effective));
  const sessionMean = $derived(mean(times.filter(Number.isFinite)));
  const sd = $derived(stdDev(times));
  const phaseAvg = $derived(phaseMeans(solves, 12, 4));
  const splitCount = $derived(solves.filter((s) => s.splits?.length === 4).length);
  // share of the solve each phase takes, as a percentage of the phases that were measured
  const phaseTotal = $derived(phaseAvg.reduce<number>((a, b) => a + (b ?? 0), 0));
  const phasePct = $derived(
    phaseAvg.map((v) => (v == null || !phaseTotal ? null : Math.round((100 * v) / phaseTotal))),
  );
  let open = $state<string | null>(null);
  let undone = $state<{ solve: (typeof solves)[number]; index: number } | null>(null);
  let undoT: ReturnType<typeof setTimeout> | undefined;
  /** the split a clear removed, while it can still be put back */
  let splitUndo = $state<{ id: string; splits: number[] } | null>(null);
  let splitUndoT: ReturnType<typeof setTimeout> | undefined;
  function clearSplit(id: string, splits: number[]) {
    store.setSplits(id, undefined);
    splitUndo = { id, splits };
    clearTimeout(splitUndoT);
    splitUndoT = setTimeout(() => (splitUndo = null), 6000);
  }

  // progress chart of the last 50 solves (DNFs are skipped)
  const pts = $derived(solves.slice(-50).map(effective));
  const finite = $derived(pts.filter(Number.isFinite));
  const lo = $derived(finite.length ? Math.min(...finite) : 0);
  const hi = $derived(finite.length ? Math.max(...finite) : 1);
  const W = 320,
    H = 110;
  // The first drawn point has to be an M, not whatever index it sits at: a DNF in the first slot used
  // to emit "L…" as the opening command, and an SVG path starting with L is invalid — the whole chart
  // painted nothing.
  const path = $derived.by(() => {
    const out: string[] = [];
    pts.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      const x = (i / Math.max(1, pts.length - 1)) * W;
      const y = H - 8 - ((v - lo) / Math.max(1, hi - lo)) * (H - 16);
      out.push(`${out.length ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return out.join(' ');
  });

  // the same deltas as the side panel: against the previous solve, the running ao5 and ao12
  const ok = (x: number | null): x is number => x != null && Number.isFinite(x);
  const fmt = (x: number | null) => (ok(x) ? `${x >= 0 ? '+' : '−'}${(Math.abs(x) / 1000).toFixed(2)}` : '–');
  const col = (x: number | null) => (!ok(x) || x === 0 ? 'var(--mu)' : x < 0 ? 'var(--good)' : 'var(--bad)');
  const tail = $derived(solves.slice(-(limit + 11)));
  // the same WCA rules as the ao5/ao12 cards, in one pass over the window
  const win = $derived(tail.map(effective));
  const a5 = $derived(runningAverage(win, 5));
  const a12 = $derived(runningAverage(win, 12));
  const deltas = $derived.by(() => {
    const out = new Map<string, { prev: number | null; a5: number | null; a12: number | null }>();
    tail.forEach((s, i) => {
      const t = win[i];
      if (!Number.isFinite(t)) return; // a DNF row shows dashes, not a delta
      const prevT = i ? win[i - 1] : null;
      const m5 = a5[i],
        m12 = a12[i];
      out.set(s.id, {
        prev: ok(prevT) ? t - prevT : null,
        a5: ok(m5) ? t - m5 : null,
        a12: ok(m12) ? t - m12 : null,
      });
    });
    return out;
  });
</script>

<svelte:window onkeydown={onKey} />

<main class="page wide">
  <div class="split">
    <div class="col" style="gap:12px">
      <div class="row sp">
        <div>
          <h1>History</h1>
          <div class="mu">{store.session.name}</div>
        </div>
        <button class="btn" onclick={onBack}>Back to timer</button>
      </div>
      <div class="row">
        <div class="card">
          <div class="mu">Solves</div>
          <b class="mono">{solves.length}</b>
        </div>
        <div class="card">
          <div class="mu">Best</div>
          <b class="mono">{formatTime(best(solves))}</b>
        </div>
        <div class="card">
          <div class="mu">Mean</div>
          <b class="mono">{formatTime(sessionMean)}</b>
        </div>
        <div class="card">
          <div class="mu">Spread</div>
          <b class="mono" style="font-size:1rem">±{formatTime(sd)}</b>
        </div>
      </div>
      <div class="row">
        <div class="card">
          <div class="mu">Best ao5</div>
          <b class="mono">{formatTime(bestAverage(solves, 5))}</b>
        </div>
        <div class="card">
          <div class="mu">Best ao12</div>
          <b class="mono">{formatTime(bestAverage(solves, 12))}</b>
        </div>
        <div class="card">
          <div class="mu">Best ao50</div>
          <b class="mono">{formatTime(bestAverage(solves, 50))}</b>
        </div>
        <div class="card">
          <div class="mu">Best ao100</div>
          <b class="mono">{formatTime(bestAverage(solves, 100))}</b>
        </div>
      </div>
      {#if phaseAvg.some((v) => v != null)}
        <div class="card">
          <div class="row sp" style="margin-bottom:8px">
            <span class="mu">Phases</span>
            <span class="mu mono" style="font-size:0.7rem">last 12 of {splitCount} split solves</span>
          </div>
          <div class="phbar" aria-hidden="true">
            {#each phaseAvg as ms, i (i)}
              {#if ms != null}<span style="flex:{ms};opacity:{1 - i * 0.19}"></span>{/if}
            {/each}
          </div>
          <div class="phrow" style="grid-template-columns:repeat({phaseAvg.length},minmax(0,1fr))">
            {#each phaseAvg as ms, i (i)}
              <div>
                <div class="ph-l">{phaseLabels(phaseAvg.length)[i]}</div>
                <b class="mono" style="font-size:0.95rem">{formatTime(ms)}</b>
                <div class="mono" style="font-size:0.68rem;color:var(--mu)">{phasePct[i] == null ? '' : `${phasePct[i]}%`}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      {#if finite.length > 1}
        <div class="card">
          <div class="row sp">
            <div class="mu">Last {pts.length} solves (lower is faster)</div>
            <div class="mu mono" style="font-size:.74rem">slow {formatTime(hi)} · fast {formatTime(lo)}</div>
          </div>
          <svg
            class="chart"
            viewBox="0 0 {W} {H}"
            preserveAspectRatio="none"
            role="img"
            aria-label="Line chart of your last {pts.length} solve times, from {formatTime(hi)} slowest to {formatTime(lo)} fastest"
          >
            <path d={path} fill="none" stroke="var(--bl)" stroke-width="2" stroke-linejoin="round" />
          </svg>
        </div>
      {/if}
      {#if !list.length}<div class="card mu">No solves yet. Time one on the Solve tab.</div>{/if}
      <div class="row mono mu hrow">
        <span class="hnum">#</span>
        <span class="htime">time</span>
        <span class="hdelta">prev</span>
        <span class="hdelta">ao5</span>
        <span class="hdelta">ao12</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        {#each list as s, i (s.id)}
          {@const d = deltas.get(s.id)}
          <div class="card row-in hrow-card" style="--i:{Math.min(i, 10)}">
            <button
              class="row sp"
              style="width:100%;background:none;border:0;padding:0;text-align:left"
              onclick={() => (open = open === s.id ? null : s.id)}
              aria-expanded={open === s.id}
            >
              <span class="mu" style="flex:none;width:44px">#{solves.length - i}</span>
              <b class="mono" style="font-size:1.1rem;flex:none;width:64px">{formatTime(effective(s))}{s.pen === '+2' ? '+' : ''}</b>
              <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.prev ?? null)}">{fmt(d?.prev ?? null)}</span>
              <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.a5 ?? null)}">{fmt(d?.a5 ?? null)}</span>
              <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.a12 ?? null)}">{fmt(d?.a12 ?? null)}</span>
            </button>
            {#if open === s.id}
              <div class="mu mono" style="margin:8px 0;word-break:break-word;user-select:text">{s.scramble}</div>
              {#if s.splits?.length}
                <div class="phbar" aria-hidden="true" style="margin-bottom:6px">
                  {#each s.splits as ms, k (k)}
                    <span style="flex:{ms};opacity:{1 - k * 0.19}"></span>
                  {/each}
                </div>
                <div class="phrow" style="grid-template-columns:repeat({s.splits.length},minmax(0,1fr));margin:0 0 8px">
                  {#each s.splits as ms, k (k)}
                    <div>
                      <div class="ph-l">{phaseLabels(s.splits.length)[k]}</div>
                      <b class="mono" style="font-size:0.9rem">{formatTime(ms)}</b>
                    </div>
                  {/each}
                </div>
              {/if}
              <div class="mu">
                {new Date(s.ts).toLocaleString()} · raw {formatTime(s.ms)} · ao5 {formatTime(
                  averageOf(solves.slice(0, solves.length - i), 5),
                )}
              </div>
              <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
                <button
                  class="btn"
                  onclick={() => {
                    store.retryScramble(s.scramble);
                    onBack();
                  }}>Retry this scramble</button
                >
                <button class="btn" onclick={() => store.cyclePenalty(s.id)}>Penalty: {s.pen || 'none'}</button>
                {#if s.splits?.length}
                  <button class="btn" onclick={() => clearSplit(s.id, s.splits!)}>Clear split</button>
                {/if}
                <button
                  class="btn"
                  onclick={() => {
                    const index = store.data.solves.findIndex((x) => x.id === s.id);
                    store.deleteSolve(s.id);
                    open = null;
                    undone = { solve: s, index };
                    clearTimeout(undoT);
                    undoT = setTimeout(() => (undone = null), 6000);
                  }}>Delete</button
                >
              </div>
            {/if}
          </div>
        {/each}
      </div>
      {#if solves.length > list.length}
        <button class="btn" onclick={() => (limit += PAGE)}>
          Show {Math.min(PAGE, solves.length - list.length)} older · {list.length} of {solves.length}
        </button>
      {/if}
    </div>
    {#if splitUndo}
      {@const su = splitUndo}
      <div class="card row sp" role="status" aria-live="polite" style="border-color:var(--am)">
        <span class="mu">Split cleared</span>
        <button
          class="btn"
          onclick={() => {
            store.setSplits(su.id, su.splits);
            splitUndo = null;
          }}>Undo</button
        >
      </div>
    {/if}
    {#if undone}
      {@const u = undone}
      <div class="card row sp" role="status" aria-live="polite" style="border-color:var(--am)">
        <span class="mu">Deleted {formatTime(effective(u.solve))}</span>
        <button
          class="btn"
          onclick={() => {
            store.restoreSolve(u.solve, u.index);
            undone = null;
            clearTimeout(undoT);
          }}>Undo</button
        >
      </div>
    {/if}
    <aside class="side" aria-label="About these numbers">
      <div class="mu">
        Each row: the time, then how it compares with the previous solve, your ao5 and your ao12. Green is faster, red is slower.
      </div>
      <ShortcutsSide view="history" inline />
    </aside>
  </div>
</main>
