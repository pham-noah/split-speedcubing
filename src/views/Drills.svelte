<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nav } from '../lib/nav.svelte';
  import TimerPad from '../lib/ui/TimerPad.svelte';
  import { ScrambleQueue } from '../lib/core/scramble';
  import { make2Look, type TwoLook } from '../lib/core/twolook';
  import { formatTime, effective, mean } from '../lib/core/stats';
  import ShortcutsSide from '../lib/ui/ShortcutsSide.svelte';
  import ScrambleWalk from '../lib/ui/ScrambleWalk.svelte';
  import { hoverEnter, hoverLeave } from '../lib/ui/hover';
  import Deltas from '../lib/ui/Deltas.svelte';
  import PenaltyRow from '../lib/ui/PenaltyRow.svelte';
  import type { DrillResult } from '../lib/storage/model';

  type Mode = DrillResult['type'];
  const MODES: { id: Mode; label: string }[] = [
    { id: 'cross', label: 'Cross' },
    { id: 'oll2', label: 'OLL' },
    { id: 'pll2', label: 'PLL' },
    { id: 'bld', label: 'BLD memo' },
  ];
  const MARK: Record<Mode, string> = {
    cross: '',
    bld: 'Tap when memorized',
    oll2: 'Tap when edges are oriented',
    pll2: 'Tap when corners are solved',
  };

  let mode = $state<Mode>(nav.drillMode);
  let running = $state(false); // A and D must not switch modes mid-drill
  let walkIndex = $state(0);
  const queue = new ScrambleQueue();
  let scramble = $state('Generating scramble…');
  let color = $state('White');
  let look = $state<TwoLook | null>(null);
  let twoLook = $state(store.data.settings.drillTwoLook ?? true); // F: two looks or one
  let pending = $state<{ ms: number; memo: number | null } | null>(null);
  const scrTokens = $derived(scramble.split(/\s+/).filter(Boolean));
  const COLORS = ['White', 'Yellow', 'Green', 'Blue', 'Red', 'Orange'];
  // colour ids: 0=U 1=D 2=R 3=L 4=F 5=B
  const ID: Record<string, number> = { Yellow: 0, White: 1, Red: 2, Orange: 3, Green: 4, Blue: 5 };
  // if red and orange are swapped in the settings, the label follows what is actually drawn
  const colorName = (name: string) => {
    if (!store.data.settings.swapRO) return name;
    return name === 'Red' ? 'Orange' : name === 'Orange' ? 'Red' : name;
  };
  const colorHex = (name: string) => {
    const palette = store.data.settings.cubeColors?.length === 6 ? store.data.settings.cubeColors : null;
    const dflt = ['#F5C542', '#F2F2F2', '#D64545', '#F08A24', '#3FA34D', '#3C6FD8'];
    const p = palette ?? dflt;
    let i = ID[name] ?? 1;
    if (store.data.settings.swapRO && (i === 2 || i === 3)) i = i === 2 ? 3 : 2;
    return p[i];
  };

  async function nextScramble() {
    pending = null;
    if (mode === 'oll2' || mode === 'pll2') {
      look = make2Look(mode);
      scramble = look.scramble;
      return;
    }
    look = null;
    scramble = 'Generating scramble…';
    color = COLORS[Math.floor(Math.random() * COLORS.length)];
    scramble = await queue.take();
  }
  function setMode(m: Mode) {
    mode = m;
    nextScramble();
  }
  function togglePen(p: '+2' | 'DNF' | '') {
    if (!p || !results.length) return;
    const now = results.at(-1)?.pen;
    store.penDrill(mode, now === p ? '' : p);
  }
  function dropDrill() {
    if (!results.length) return;
    store.deleteLastDrill(mode);
  }
  function onKey(e: KeyboardEvent) {
    if (running) return;
    if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (store.is(e, 'drillTwoLook') && isLookMode) {
      twoLook = !twoLook;
      store.update({ drillTwoLook: twoLook });
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (store.is(e, 'drillNext')) {
      nextScramble();
      e.preventDefault();
      return;
    }
    if (store.is(e, 'plus2')) {
      togglePen('+2');
      e.preventDefault();
      return;
    }
    if (store.is(e, 'dnf')) {
      togglePen('DNF');
      e.preventDefault();
      return;
    }
    if (store.is(e, 'deleteLast')) {
      dropDrill();
      e.preventDefault();
      return;
    }
    const i = MODES.findIndex((m) => m.id === mode);
    if (store.is(e, 'libPrev')) {
      setMode(MODES[(i - 1 + MODES.length) % MODES.length].id);
      e.preventDefault();
    } else if (store.is(e, 'libNext')) {
      setMode(MODES[(i + 1) % MODES.length].id);
      e.preventDefault();
    }
  }
  nextScramble();

  const results = $derived(store.data.drills.filter((d) => d.type === mode));
  const recent = $derived(results.slice(-10));
  const okOnly = $derived(recent.filter((d) => d.ok));
  // a penalty has to reach the numbers, not just the button: +2 adds two seconds, a DNF has no time
  const exec = (d: DrillResult) => effective({ ms: d.ms, pen: d.pen ?? '' });
  const timed = $derived(okOnly.map(exec).filter(Number.isFinite));
  // the drill that just finished, with whatever penalty has been put on it since
  // a BLD drill is only stored when you say whether it worked, so until then results.at(-1) is the
  // PREVIOUS drill and its penalty must not be applied to the time on screen
  let pendingRecorded = $state(false);
  const lastPen = $derived(pendingRecorded ? (results.at(-1)?.pen ?? '') : '');
  const pendingMs = $derived(pending ? (lastPen === 'DNF' ? Infinity : pending.ms + (lastPen === '+2' ? 2000 : 0)) : null);
  const isLookMode = $derived(mode === 'oll2' || mode === 'pll2');
  const twoStage = $derived(isLookMode ? twoLook : mode !== 'cross');

  function finish(r: { ms: number; recog: number | null }) {
    if (mode === 'cross') {
      store.addDrill({ type: 'cross', ms: r.ms, memo: null, ok: true });
      nextScramble();
      return;
    }
    if (mode === 'bld') {
      pendingRecorded = false;
      pending = { ms: r.ms, memo: r.recog };
      return;
    }
    // 2-look: record straight away and show what the cases were
    store.addDrill({
      type: mode,
      ms: r.ms,
      memo: r.recog,
      ok: true,
      info: twoLook ? `${look?.stage1?.name ?? 'skip'} + ${look?.stage2?.name ?? 'skip'}` : 'one look',
    });
    pendingRecorded = true;
    pending = { ms: r.ms, memo: r.recog };
  }
  function mark(ok: boolean) {
    if (!pending) return;
    store.addDrill({ type: 'bld', ms: pending.ms, memo: pending.memo, ok });
    nextScramble();
  }
  const stage1Label = $derived(mode === 'oll2' ? 'Edges' : mode === 'pll2' ? 'Corners' : 'Memo');
  const stage2Label = $derived(mode === 'oll2' ? 'Corners' : mode === 'pll2' ? 'Edges' : 'Execution');
</script>

<svelte:window onkeydown={onKey} />

<main class="page wide fill">
  <div class="split">
    <div class="col" style="gap:12px">
      <h1>Drills</h1>
      <div class="seg" role="group" aria-label="Drill type">
        {#each MODES as m (m.id)}<button
            class:on={mode === m.id}
            onclick={() => setMode(m.id)}
            onpointerenter={() => hoverEnter(() => setMode(m.id))}
            onpointerleave={hoverLeave}>{m.label}</button
          >{/each}
      </div>
      {#if mode === 'cross'}<div class="mu">
          Cross colour <span
            style="display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;background:{colorHex(
              color,
            )};border:1px solid #0006"
          ></span> <b style="color:{colorHex(color)}">{colorName(color)}</b>
        </div>{/if}

      <div class="scr mono">
        {#each scrTokens as t, idx (idx)}<span class:now={idx === walkIndex}>{t}</span>{' '}{/each}
      </div>
      {#if !store.cubeHidden && scramble.includes(' ') && !scramble.startsWith('Generating')}
        <div class="cube-panel" style="display:flex;justify-content:center">
          <ScrambleWalk
            alg={scramble}
            size={90}
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

      {#if mode === 'bld' && recent.length}
        <div class="mu" style="text-align:center" role="status">
          last {recent.length} memos · {okOnly.length} correct ({Math.round((okOnly.length / recent.length) * 100)}%)
        </div>
      {/if}

      {#if isLookMode}
        <div class="mu" style="text-align:center" role="status">
          {#if twoLook}
            2-look · tap when {stage1Label.toLowerCase()}, then stop
          {:else}
            One look · press once to stop
          {/if}
          <span class="pc-only"> · F changes this</span>
        </div>
      {/if}

      {#if pending}
        <div class="time mono">{formatTime(pendingMs)}</div>
        {#if twoStage || mode === 'bld'}
          <div class="mu" style="text-align:center">
            {stage1Label} <b class="mono" style="color:var(--tx)">{formatTime(pending.memo)}</b> &nbsp; {stage2Label}
            <b class="mono" style="color:var(--tx)">{formatTime(pending.memo == null ? null : pending.ms - pending.memo)}</b>
          </div>
        {/if}
        {#if (mode === 'oll2' || mode === 'pll2') && !twoLook}
          <button class="btn p" onclick={nextScramble}>Next</button>
        {:else if mode === 'bld'}
          <div class="mu" style="text-align:center">Was the solve successful?</div>
          <div class="row">
            <button class="btn p" onclick={() => mark(true)}>Success</button><button class="btn" onclick={() => mark(false)}>Failed</button>
          </div>
        {:else if look}
          <div class="card" style="display:flex;flex-direction:column;gap:6px">
            <div>
              <b>{stage1Label}:</b>
              {look.stage1?.name ?? 'already solved'}{#if look.stage1}
                <span class="mono mu">{look.stage1.alg}</span>{/if}
            </div>
            <div>
              <b>{stage2Label}:</b>
              {look.stage2?.name ?? 'already solved'}{#if look.stage2}
                <span class="mono mu">{look.stage2.alg}</span>{/if}
            </div>
          </div>
          <button class="btn p" onclick={nextScramble}>Next</button>
        {/if}
      {:else}
        <TimerPad
          twoPress={twoStage}
          markLabel={MARK[mode]}
          holdMs={store.data.settings.holdMs}
          tapStart={store.data.settings.tapStart}
          shown={results.at(-1) ? exec(results.at(-1)!) : null}
          cover={store.data.settings.coverOn}
          coverColor={store.data.settings.coverColor}
          onfinish={finish}
          onRunning={(b) => (running = b)}
        />
      {/if}

      <div class="row stats-dock">
        <div class="card">
          <div class="mu">Last 10 average</div>
          <b class="mono">{formatTime(mean(timed))}</b>
        </div>
        {#if twoStage}
          <div class="card">
            <div class="mu">{stage1Label} avg</div>
            <b class="mono">{formatTime(mean(okOnly.filter((d) => d.memo != null && d.pen !== 'DNF').map((d) => d.memo!)))}</b>
          </div>
        {/if}
        {#if mode === 'bld'}
          <div class="card">
            <div class="mu">Success</div>
            <b class="mono">{recent.length ? Math.round((okOnly.length / recent.length) * 100) : 0}%</b>
          </div>
        {:else if !twoStage}
          <div class="card">
            <div class="mu">Drills done</div>
            <b class="mono">{results.length}</b>
          </div>
        {/if}
      </div>
      <ShortcutsSide view="drills" />
    </div>
    <aside class="side" aria-label="Drill attempts">
      {#if results.length}
        <PenaltyRow pen={results.at(-1)?.pen ?? ''} onpen={togglePen} ondelete={dropDrill} />
      {/if}
      <Deltas times={results.map(exec).filter(Number.isFinite)} title="Recent {MODES.find((m) => m.id === mode)?.label} attempts" />
      <ShortcutsSide view="drills" inline />
    </aside>
  </div>
</main>
