<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { averageOf, bestAverage, best, effective, formatTime, runningAverage } from '../lib/core/stats';
  import ShortcutsSide from '../lib/ui/ShortcutsSide.svelte';
  const { onBack }: { onBack: () => void } = $props();

  // Escape goes back; so does the "New scramble" key (S by default), which is how S has always worked here
  function onKey(e: KeyboardEvent) {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
    if (store.is(e, 'back') || store.is(e, 'scramble')) { e.preventDefault(); onBack(); }
  }
  const solves = $derived(store.solves);
  const list = $derived([...solves].reverse().slice(0, 200));
  let open = $state<string | null>(null);
  let undone = $state<{ solve: (typeof solves)[number]; index: number } | null>(null);
  let undoT: ReturnType<typeof setTimeout> | undefined;

  // progress chart of the last 50 solves (DNFs are skipped)
  const pts = $derived(solves.slice(-50).map(effective));
  const finite = $derived(pts.filter(Number.isFinite));
  const lo = $derived(finite.length ? Math.min(...finite) : 0);
  const hi = $derived(finite.length ? Math.max(...finite) : 1);
  const W = 320, H = 110;
  const path = $derived(pts.map((v, i) => (Number.isFinite(v) ? `${i ? 'L' : 'M'}${(i / Math.max(1, pts.length - 1)) * W},${H - 8 - ((v - lo) / Math.max(1, hi - lo)) * (H - 16)}` : '')).filter(Boolean).join(' '));

  // the same deltas as the side panel: against the previous solve, the running ao5 and ao12
  const ok = (x: number | null): x is number => x != null && Number.isFinite(x);
  const fmt = (x: number | null) => (ok(x) ? `${x >= 0 ? '+' : '−'}${(Math.abs(x) / 1000).toFixed(2)}` : '–');
  const col = (x: number | null) => (!ok(x) || x === 0 ? 'var(--mu)' : x < 0 ? 'var(--good)' : 'var(--bad)');
  // the same WCA rules as the ao5/ao12 cards, in one pass over the session
  const times = $derived(solves.map(effective));
  const a5 = $derived(runningAverage(times, 5));
  const a12 = $derived(runningAverage(times, 12));
  const deltas = $derived.by(() => {
    const out = new Map<string, { prev: number | null; a5: number | null; a12: number | null }>();
    solves.forEach((s, i) => {
      const t = times[i];
      if (!Number.isFinite(t)) return;                       // a DNF row shows dashes, not a delta
      const prevT = i ? times[i - 1] : null;
      const m5 = a5[i], m12 = a12[i];
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
  <div class="split"><div class="col" style="gap:12px">
    <div class="row sp"><div><h1>History</h1><div class="mu">{store.session.name}</div></div><button class="btn" onclick={onBack}>Back to timer</button></div>
    <div class="row">
      <div class="card"><div class="mu">Solves</div><b class="mono">{solves.length}</b></div>
      <div class="card"><div class="mu">Best</div><b class="mono">{formatTime(best(solves))}</b></div>
      <div class="card"><div class="mu">Best ao5</div><b class="mono">{formatTime(bestAverage(solves, 5))}</b></div>
      <div class="card"><div class="mu">Best ao12</div><b class="mono">{formatTime(bestAverage(solves, 12))}</b></div>
    </div>
    {#if finite.length > 1}
      <div class="card">
        <div class="mu">Last {pts.length} solves (lower is faster)</div>
        <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Line chart of your last {pts.length} solve times, from {formatTime(hi)} slowest to {formatTime(lo)} fastest">
          <path d={path} fill="none" stroke="var(--bl)" stroke-width="2" stroke-linejoin="round" />
        </svg>
      </div>
    {/if}
    {#if !list.length}<div class="card mu">No solves yet. Time one on the Solve tab.</div>{/if}
    <div class="row mono mu" style="font-size:.72rem;padding:0 2px">
      <span style="flex:none;width:44px">#</span>
      <span style="flex:none;width:64px">time</span>
      <span style="flex:1;text-align:right">prev</span>
      <span style="flex:1;text-align:right">ao5</span>
      <span style="flex:1;text-align:right">ao12</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      {#each list as s, i (s.id)}
        {@const d = deltas.get(s.id)}
        <div class="card">
          <button class="row sp" style="width:100%;background:none;border:0;padding:0;text-align:left" onclick={() => (open = open === s.id ? null : s.id)} aria-expanded={open === s.id}>
            <span class="mu" style="flex:none;width:44px">#{solves.length - i}</span>
            <b class="mono" style="font-size:1.1rem;flex:none;width:64px">{formatTime(effective(s))}{s.pen === '+2' ? '+' : ''}</b>
            <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.prev ?? null)}">{fmt(d?.prev ?? null)}</span>
            <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.a5 ?? null)}">{fmt(d?.a5 ?? null)}</span>
            <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.a12 ?? null)}">{fmt(d?.a12 ?? null)}</span>
          </button>
          {#if open === s.id}
            <div class="mu mono" style="margin:8px 0;word-break:break-word;user-select:text">{s.scramble}</div>
            <div class="mu">{new Date(s.ts).toLocaleString()} · raw {formatTime(s.ms)} · ao5 {formatTime(averageOf(solves.slice(0, solves.length - i), 5))}</div>
            <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
              <button class="btn" onclick={() => { store.retryScramble(s.scramble); onBack(); }}>Retry this scramble</button>
              <button class="btn" onclick={() => store.cyclePenalty(s.id)}>Penalty: {s.pen || 'none'}</button>
              <button class="btn" onclick={() => {
              const index = store.data.solves.findIndex(x => x.id === s.id);
              store.deleteSolve(s.id); open = null;
              undone = { solve: s, index };
              clearTimeout(undoT); undoT = setTimeout(() => (undone = null), 6000);
            }}>Delete</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
  {#if undone}
    {@const u = undone}
    <div class="card row sp" role="status" aria-live="polite" style="border-color:var(--am)">
      <span class="mu">Deleted {formatTime(effective(u.solve))}</span>
      <button class="btn" onclick={() => { store.restoreSolve(u.solve, u.index); undone = null; clearTimeout(undoT); }}>Undo</button>
    </div>
  {/if}
  <aside class="side" aria-label="About these numbers">
    <div class="mu">Each row: the time, then how it compares with the previous solve, your ao5 and your ao12. Green is faster, red is slower.</div>
    <ShortcutsSide view="history" inline />
  </aside></div>
</main>
