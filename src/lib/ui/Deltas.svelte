<script lang="ts">
  import { formatTime } from '../core/stats';

  // Last attempts with three deltas each: against the previous attempt, the running ao5 and the running ao12.
  // Faster than the reference is green, slower is red.
  const { times, rows = 5, title = 'Recent attempts' }: { times: number[]; rows?: number; title?: string } = $props();

  const fmt = (x: number | null) => (x == null ? '–' : `${x >= 0 ? '+' : '−'}${(Math.abs(x) / 1000).toFixed(2)}`);
  const col = (x: number | null) => (x == null || x === 0 ? 'var(--mu)' : x < 0 ? 'var(--good)' : 'var(--bad)');
  const cellStyle = (x: number | null) => `flex:1;text-align:right;color:${col(x)}`;
  const mean = (end: number, n: number) => {
    const xs = times.slice(Math.max(0, end - n + 1), end + 1);
    return xs.length === n ? xs.reduce((a, b) => a + b, 0) / n : null;
  };
  const list = $derived.by(() =>
    times.map((t, i) => {
      const a5 = mean(i, 5), a12 = mean(i, 12);
      return { i, t, prev: i ? t - times[i - 1] : null, a5: a5 == null ? null : t - a5, a12: a12 == null ? null : t - a12 };
    }).slice(-rows).reverse(),
  );
  const ao5 = $derived(mean(times.length - 1, 5));
  const ao12 = $derived(mean(times.length - 1, 12));
</script>

<div class="deltas">
  <div class="mu">{title}</div>
  <div class="mu" style="margin-top:2px">ao5 <b class="mono" style="color:var(--tx)">{formatTime(ao5)}</b> · ao12 <b class="mono" style="color:var(--tx)">{formatTime(ao12)}</b></div>
  {#if list.length}
    <div class="row mono mu" style="padding:6px 0 2px;font-size:.72rem">
      <span style="flex:none;width:52px">time</span>
      <span style="flex:1;text-align:right">prev</span>
      <span style="flex:1;text-align:right">ao5</span>
      <span style="flex:1;text-align:right">ao12</span>
    </div>
    <div class="drows">
    {#each list as r (r.i)}
      <div class="row mono drow" style="padding:3px 0;font-size:.82rem">
        <span style="flex:none;width:52px">{formatTime(r.t)}</span>
        <span style={cellStyle(r.prev)}>{fmt(r.prev)}</span>
        <span style={cellStyle(r.a5)}>{fmt(r.a5)}</span>
        <span style={cellStyle(r.a12)}>{fmt(r.a12)}</span>
      </div>
    {/each}
    </div>
  {:else}
    <div class="mu" style="margin-top:6px">None yet.</div>
  {/if}
</div>
