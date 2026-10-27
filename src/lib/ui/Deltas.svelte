<script lang="ts">
  import { formatTime, runningAverage } from '../core/stats';

  // Last attempts with three deltas each: against the previous attempt, the running ao5 and the running ao12.
  // Faster than the reference is green, slower is red. The averages follow WCA rules (averageOf), so
  // the number here matches the ao5 card on the same screen.
  const { times, rows = 5, title = 'Recent attempts' }: { times: number[]; rows?: number; title?: string } = $props();

  const ok = (x: number | null): x is number => x != null && Number.isFinite(x);
  const fmt = (x: number | null) => (ok(x) ? `${x >= 0 ? '+' : '−'}${(Math.abs(x) / 1000).toFixed(2)}` : '–');
  const col = (x: number | null) => (!ok(x) || x === 0 ? 'var(--mu)' : x < 0 ? 'var(--good)' : 'var(--bad)');
  const cellStyle = (x: number | null) => `flex:1;text-align:right;color:${col(x)}`;
  const list = $derived.by(() => {
    const a5 = runningAverage(times, 5), a12 = runningAverage(times, 12);
    return times.map((t, i) => ({
      i,
      t,
      prev: i && ok(t) && ok(times[i - 1]) ? t - times[i - 1] : null,
      a5: ok(t) && ok(a5[i]) ? t - (a5[i] as number) : null,
      a12: ok(t) && ok(a12[i]) ? t - (a12[i] as number) : null,
    })).slice(-rows).reverse();
  });
  const ao5 = $derived(runningAverage(times, 5).at(-1) ?? null);
  const ao12 = $derived(runningAverage(times, 12).at(-1) ?? null);
</script>

<div class="deltas">
  <div class="mu">{title}</div>
  <div class="mu" style="margin-top:2px">ao5 <b class="mono" style="color:var(--tx)">{formatTime(ao5)}</b> · ao12 <b class="mono" style="color:var(--tx)">{formatTime(ao12)}</b></div>
  {#if list.length}
    <!-- a real table for screen readers: rows are grouped, so each one is read as time / prev / ao5 / ao12 -->
    <div role="table" aria-label={title}>
      <div role="rowgroup">
        <div class="row mono mu" role="row" style="padding:6px 0 2px;font-size:.72rem">
          <span role="columnheader" style="flex:none;width:52px">time</span>
          <span role="columnheader" style="flex:1;text-align:right">prev</span>
          <span role="columnheader" style="flex:1;text-align:right">ao5</span>
          <span role="columnheader" style="flex:1;text-align:right">ao12</span>
        </div>
      </div>
      <div class="drows" role="rowgroup">
      {#each list as r (r.i)}
        <div class="row mono drow" role="row" style="padding:3px 0;font-size:.82rem">
          <span role="cell" style="flex:none;width:52px">{formatTime(r.t)}</span>
          <span role="cell" style={cellStyle(r.prev)}>{fmt(r.prev)}</span>
          <span role="cell" style={cellStyle(r.a5)}>{fmt(r.a5)}</span>
          <span role="cell" style={cellStyle(r.a12)}>{fmt(r.a12)}</span>
        </div>
      {/each}
      </div>
    </div>
  {:else}
    <div class="mu" style="margin-top:6px">None yet.</div>
  {/if}
</div>
