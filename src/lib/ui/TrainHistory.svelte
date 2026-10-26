<script lang="ts">
  import { store } from '../store.svelte';
  import ShortcutsSide from './ShortcutsSide.svelte';
  import { formatTime } from '../core/stats';

  // Training history: the attempts made while training, not solve times. One case, or all of them.
  let { caseId = null, onBack }: { caseId?: string | null; onBack: () => void } = $props();

  const name = (id: string) => {
    const c = store.caseOf(id);
    return c ? c.name : id;
  };
  const cards = $derived(store.data.cards);

  type Row = { id: string; caseId: string; ts: number; total: number; recog: number | null; alg?: string };
  const exec = (a: Row) => a.total - (a.recog ?? 0);

  // per case, the same deltas as everywhere else: previous attempt, running ao5 and ao12
  const deltas = $derived.by(() => {
    const byCase = new Map<string, Row[]>();
    for (const [id, card] of Object.entries(cards)) {
      if (caseId && id !== caseId) continue;
      const rows: Row[] = card.attempts.map(a => ({ id, caseId: id, ts: a.ts, total: a.total, recog: a.recog, alg: a.alg }));
      rows.sort((a, b) => a.ts - b.ts);
      byCase.set(id, rows);
    }
    const out = new Map<string, { prev: number | null; a5: number | null; a12: number | null }>();
    for (const rows of byCase.values()) {
      const ex = rows.map(exec);
      rows.forEach((r, i) => {
        const slice = (n: number) => ex.slice(Math.max(0, i - n + 1), i + 1);
        const a5 = slice(5).length === 5 ? slice(5).reduce((a, b) => a + b, 0) / 5 : null;
        const a12 = slice(12).length === 12 ? slice(12).reduce((a, b) => a + b, 0) / 12 : null;
        out.set(r.id + r.ts, {
          prev: i ? ex[i] - ex[i - 1] : null,
          a5: a5 == null ? null : ex[i] - a5,
          a12: a12 == null ? null : ex[i] - a12,
        });
      });
    }
    return out;
  });

  const all = $derived.by(() =>
    Object.entries(cards)
      .filter(([id]) => !caseId || id === caseId)
      .flatMap(([id, card]) => card.attempts.map(a => ({ id, caseId: id, ts: a.ts, total: a.total, recog: a.recog, alg: a.alg })))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 200),
  );
  const execs = $derived(all.map(exec));
  const bestExec = $derived(execs.length ? Math.min(...execs) : null);
  const avgExec = $derived(execs.length ? execs.reduce((a, b) => a + b, 0) / execs.length : null);

  // per case: where the time goes, slowest first — what to drill next
  const byCase = $derived.by(() => {
    const out: { id: string; avg: number; best: number; n: number }[] = [];
    for (const [id, card] of Object.entries(cards)) {
      if (caseId && id !== caseId) continue;
      const ex = card.attempts.map(a => a.total - (a.recog ?? 0));
      if (!ex.length) continue;
      out.push({ id, avg: ex.reduce((x, y) => x + y, 0) / ex.length, best: Math.min(...ex), n: ex.length });
    }
    return out.sort((a, b) => b.avg - a.avg).slice(0, 6);
  });

  // how many attempts a week, last 8 weeks: consistency, not speed
  const weekly = $derived.by(() => {
    const wk = 7 * 86400000;
    const now = Date.now();
    return Array.from({ length: 8 }, (_, i) => {
      const end = now - (7 - i) * wk;
      const start = end - wk;
      return all.filter(r => r.ts > start && r.ts <= end).length;
    });
  });
  const weekMax = $derived(Math.max(1, ...weekly));

  const fmt = (x: number | null) => (x == null ? '–' : `${x >= 0 ? '+' : '−'}${(Math.abs(x) / 1000).toFixed(2)}`);
  const col = (x: number | null) => (x == null ? 'var(--mu)' : x < 0 ? 'var(--good)' : 'var(--bad)');
</script>

<main class="page wide">
  <div class="split"><div class="col" style="gap:12px">
    <div class="row sp">
      <div><h1>Training history</h1><div class="mu">{caseId ? name(caseId) : 'every case you have trained'}</div></div>
      <button class="btn" onclick={onBack}>Back</button>
    </div>
    <div class="row">
      <div class="card"><div class="mu">Attempts</div><b class="mono">{all.length}</b></div>
      <div class="card"><div class="mu">Best</div><b class="mono">{formatTime(bestExec)}</b></div>
      <div class="card"><div class="mu">Average</div><b class="mono">{formatTime(avgExec)}</b></div>
    </div>

    {#if !all.length}
      <div class="card mu">No attempts yet. Train a case and it lands here.</div>
    {:else}
      <div class="card" aria-label="Slowest cases">
        <div class="mu">Slowest cases · execution average</div>
        <div class="col" style="gap:6px;margin-top:8px">
          {#each byCase as c (c.id)}
            <div class="row sp prow" style="padding:2px 0">
              <span style="font-weight:700">{name(c.id).replace('-perm', '').replace('OLL ', '')}</span>
              <span class="mu mono">{formatTime(c.avg)} avg · {formatTime(c.best)} best · {c.n} attempts</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="card" aria-label="Attempts per week">
        <div class="mu">Attempts a week · last 8 weeks</div>
        <div class="row" style="align-items:flex-end;gap:6px;height:64px;margin-top:10px">
          {#each weekly as n, i (i)}
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="width:100%;height:{Math.round((n / weekMax) * 44) + 2}px;border-radius:3px;background:{i === 7 ? 'var(--am)' : '#3A4150'}"></div>
              <span class="mu" style="font-size:.62rem">{n}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="row mono mu" style="font-size:.72rem;padding:0 2px">
      <span style="flex:none;width:96px">case</span>
      <span style="flex:none;width:68px">exec</span>
      <span style="flex:1;text-align:right">prev</span>
      <span style="flex:1;text-align:right">ao5</span>
      <span style="flex:1;text-align:right">ao12</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      {#each all as r (r.caseId + r.ts)}
        {@const d = deltas.get(r.caseId + r.ts)}
        <div class="card row sp">
          <span class="mu" style="flex:none;width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{name(r.caseId).replace('-perm', '').replace('OLL ', '')}</span>
          <b class="mono" style="flex:none;width:68px;font-size:1rem">{formatTime(exec(r))}</b>
          <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.prev ?? null)}">{fmt(d?.prev ?? null)}</span>
          <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.a5 ?? null)}">{fmt(d?.a5 ?? null)}</span>
          <span class="mono" style="flex:1;text-align:right;font-size:.78rem;color:{col(d?.a12 ?? null)}">{fmt(d?.a12 ?? null)}</span>
        </div>
      {/each}
    </div>
  </div>
  <aside class="side" aria-label="About these numbers">
    <div class="mu">Every finished attempt, newest first: execution time, then how it compares with your previous attempt on that case, that case's ao5 and ao12. Green is faster, red is slower.</div>
    <ShortcutsSide view="train" inline />
  </aside></div>
</main>
