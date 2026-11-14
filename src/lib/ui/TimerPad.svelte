<script lang="ts">
  import { onDestroy } from 'svelte';
  import { store } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { codeLabel } from '../core/shortcuts';
  import { formatTime, splitSegments, PHASES, type Penalty } from '../core/stats';
  import { inspectionPenalty, inspectionText } from '../core/inspection';
  import { readableInk } from './color';

  type St = 'idle' | 'insp' | 'hold' | 'ready' | 'run';
  const { twoPress = false, markLabel = 'Tap when recognized', disabled = false, holdMs = 300, tapStart = false, hideTime = false, inspection = false, beeps = true, shown = null, cover = false, coverColor = '', splits = false, onfinish, onRunning }: {
    twoPress?: boolean; markLabel?: string; disabled?: boolean; holdMs?: number; tapStart?: boolean; hideTime?: boolean;
    inspection?: boolean; beeps?: boolean; shown?: number | null; cover?: boolean; coverColor?: string;
    /** opt-in phase splits: while the clock runs, a press on the split zone marks a phase instead of stopping */
    splits?: boolean;
    onfinish: (r: { ms: number; recog: number | null; pen: Penalty; splits?: number[] }) => void;
    onRunning?: (running: boolean) => void;
  } = $props();

  let st = $state<St>('idle');
  let now = $state(0);          // elapsed ms of the solve
  let inspElapsed = $state(0);  // elapsed ms of inspection
  let inspActive = $state(false);
  let marked = $state(false);
  /** a press this soon after the start is a fumble, not a solve: dropped rather than saved as a Best */
  const MIN_SOLVE_MS = 300;
  let tooShort = $state(false);
  /** elapsed times at each phase mark, in ms from the start; the last segment runs to the stop */
  let marks = $state<number[]>([]);
  /** a mark this soon after the last one is a double tap, not a phase ending */
  const MIN_MARK_GAP = 120;
  let coverOpen = $state(false);   // the colour has grown out of the button to fill the screen
  let stopped = $state<number | null>(null); // finished time, shown highlighted on the cover before it shrinks back
  let bigEl: HTMLButtonElement | undefined;
  let cx = $state(0), cy = $state(0);
  let flashT: ReturnType<typeof setTimeout> | undefined;
  let t0 = 0, tI = 0, recog: number | null = null, holdTimer: ReturnType<typeof setTimeout> | undefined, raf = 0, beeped = 0;
  let audio: AudioContext | undefined;
  let wake: any = null;   // keeps the phone screen on while the clock runs
  let pendingPen: Penalty = '';
  let ink = $state('#FFFFFF');   // readable ink for whatever colour the cover is, worked out on open
  /** The flood is pointer-events:none, so the stop press lands on whatever is behind it and the browser
   *  then clicks that element. Swallow one click after a stop; a new press clears the guard. */
  let swallowClick = false;
  function onClickCapture(e: MouseEvent) {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }

  // dark ink on light covers, white on dark ones
  function readable(hex: string): string {
    return readableInk(hex, '#06121F', '#FFFFFF');
  }
  function openCover() {
    if (!cover || !bigEl) return;
    const r = bigEl.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    // the flood is --cover or the theme's blue; white on pale blue is unreadable, so measure it
    const flood = coverColor || getComputedStyle(document.documentElement).getPropertyValue('--bl').trim();
    ink = readable(flood);
    clearTimeout(flashT); stopped = null; coverOpen = true;
  }
  function closeCoverSoon(ms: number) {
    if (!cover) return;
    stopped = ms;
    clearTimeout(flashT);
    flashT = setTimeout(() => { coverOpen = false; stopped = null; }, 900);
  }

  const label = $derived(
    st === 'hold' ? 'Keep holding' : st === 'ready' ? 'Release!' :
    st === 'run' ? (twoPress && !marked ? markLabel : 'Tap to stop') :
    inspActive ? (tapStart ? 'Tap to start' : 'Hold to start') : inspection ? 'Tap to start inspection' : (tapStart ? 'Tap to start' : 'Hold to start')
  );
  const shownText = $derived(
    st === 'run' ? (hideTime ? 'Solving…' : formatTime(now)) :
    inspActive ? inspectionText(inspElapsed) :
    tooShort ? 'Too short' :
    // no solve yet: an empty line, not a lone dash that reads as a stray divider
    shown == null ? '' : formatTime(shown)
  );

  function beep(freq: number, len = 0.12) {
    if (!beeps) return;
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq; g.gain.value = 0.15;
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + len);
    } catch { /* audio not available */ }
  }

  function loop() {
    if (st === 'run') { now = performance.now() - t0; }
    else if (inspActive) {
      inspElapsed = performance.now() - tI;
      if (beeped < 1 && inspElapsed >= 8000) { beeped = 1; beep(660); }
      if (beeped < 2 && inspElapsed >= 12000) { beeped = 2; beep(880, 0.2); }
    } else return;
    raf = requestAnimationFrame(loop);
  }
  const endInspection = () => { inspActive = false; };
  // the whole app needs to know a timer is running: tab shortcuts must not navigate away from a live solve
  $effect(() => {
    const busy = st === 'run' || st === 'hold' || st === 'ready';
    store.timerRunning = busy;
    onRunning?.(busy);
  });

  // a phone that dims mid-solve is worse than a slightly brighter screen
  async function keepAwake() {
    try {
      const api = navigator as any;
      if (!api.wakeLock || wake) return;
      wake = await api.wakeLock.request('screen');
      wake.addEventListener?.('release', () => { wake = null; });
    } catch { /* not supported, or the page is in the background */ }
  }
  function letSleep() {
    try { wake?.release?.(); } catch { /* already gone */ }
    wake = null;
  }

  /** Mark the end of a phase without stopping the clock. Opt-in: with splits off, the split zone is not
   *  rendered and this can never fire. */
  function mark() {
    if (!splits || st !== 'run') return;
    if (marks.length >= PHASES.length - 1) return;   // three marks already separate the four phases
    const t = performance.now() - t0;
    if (t - (marks.at(-1) ?? 0) < MIN_MARK_GAP) return;
    marks = [...marks, t];
  }

  /** a mark that landed on the wrong phase is data, not fate: take the last one back */
  function unmark() {
    if (!splits || st !== 'run' || !marks.length) return;
    marks = marks.slice(0, -1);
  }

  function down() {
    if (disabled) return;
    if (st === 'run') {
      if (twoPress && !marked) { recog = performance.now() - t0; marked = true; return; }
      const ms = performance.now() - t0;
      cancelAnimationFrame(raf);
      st = 'idle';
      swallowClick = true;   // the click this press will also fire belongs to nothing
      // a fumbled double-tap is not a solve: drop it and say so, rather than saving 0.05 s
      if (ms < MIN_SOLVE_MS) {
        recog = null; pendingPen = ''; marked = false;
        stopped = null; coverOpen = false;
        tooShort = true;
        clearTimeout(flashT);
        flashT = setTimeout(() => (tooShort = false), 1500);
        letSleep();
        return;
      }
      closeCoverSoon(ms);
      letSleep();
      const seg = splits ? splitSegments(marks, ms) : [];
      marks = [];
      onfinish({ ms, recog, pen: pendingPen, ...(seg.length ? { splits: seg } : {}) });
      pendingPen = '';
      return;
    }
    tooShort = false;
    swallowClick = false;   // a new gesture: any guard left from the last one is history
    if (st === 'idle' && inspection && !inspActive) {
      tI = performance.now(); inspElapsed = 0; inspActive = true; beeped = 0; st = 'insp';
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      return;
    }
    if (st === 'idle' || st === 'insp') {
      if (tapStart) {
        // no hold: the press itself starts the solve
        const pen = inspActive ? inspectionPenalty(performance.now() - tI) : '';
        endInspection();
        st = 'run'; marked = false; recog = null; marks = []; t0 = performance.now(); now = 0; pendingPen = pen; keepAwake();
        cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
        return;
      }
      st = 'hold';
      openCover();
      holdTimer = setTimeout(() => { if (st === 'hold') st = 'ready'; }, holdMs);
    }
  }
  function up() {
    if (st === 'ready') {
      const pen = inspActive ? inspectionPenalty(performance.now() - tI) : '';
      endInspection();
      st = 'run'; marked = false; recog = null; marks = []; t0 = performance.now(); now = 0;
      pendingPen = pen; keepAwake();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    } else if (st === 'hold') {
      clearTimeout(holdTimer);
      st = inspActive ? 'insp' : 'idle';
      coverOpen = false; // let go before the timer was ready: the colour goes back down
    }
  }
  function cancel() { clearTimeout(holdTimer); cancelAnimationFrame(raf); endInspection(); st = 'idle'; marks = []; clearTimeout(flashT); coverOpen = false; stopped = null; tooShort = false; letSleep(); }

  // Esc / Android Back cancels the timer instead of leaving the screen, including a solve in progress
  $effect(() => { if (inspActive || st === 'hold' || st === 'ready' || st === 'run') return nav.onBack(() => { cancel(); return true; }); });
  // the click that follows a stop press must not reach whatever was underneath it (capture, so a
  // delegated handler on the root never sees it either)
  $effect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('click', onClickCapture, true);
    return () => window.removeEventListener('click', onClickCapture, true);
  });
  // the browser drops the lock when the tab goes away: take it again if the clock is still running
  $effect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && st === 'run') keepAwake(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  });
  onDestroy(() => { cancelAnimationFrame(raf); clearTimeout(holdTimer); clearTimeout(flashT); letSleep(); store.timerRunning = false; audio?.close().catch(() => {}); });
  const typing = (e: Event) => /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
</script>

<svelte:window
  onkeydown={(e) => {
    if (typing(e)) return;
    if (splits && st === 'run' && store.is(e, 'split')) {
      e.preventDefault(); e.stopPropagation(); if (!e.repeat) mark(); return;
    }
    if (store.is(e, 'timer')) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) down(); }
  }}
  onkeyup={(e) => { if (store.is(e, 'timer')) up(); }}
  onpointerdown={(e) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    // the split pill is the one surface that does not stop the clock: its own click marks the phase
    if (st === 'run' && splits && t.closest('.split-dock')) return;
    if (st === 'run' ? !t.closest('nav') : !!t.closest('.big')) down();
  }}
  onpointerup={up}
  onpointercancel={up}
/>

<div class="time mono" class:done={st === 'idle' && shown != null && !tooShort} class:note={tooShort} aria-hidden="true">{shownText}</div>
{#if cover}
  <div class="cover" class:on={coverOpen} aria-hidden="true"
    style="--cx:{cx}px;--cy:{cy}px;--cover:{coverColor || 'var(--bl)'}"></div>
  <div class="cover-stage" class:on={coverOpen} aria-hidden="true" style="--hold:{holdMs}ms;color:{ink}">
    {#if st === 'hold' || st === 'ready'}
      <!-- the cover sits above the button, so the hold has to report itself here or the wait is blind -->
      <div class="cover-hold" class:ready={st === 'ready'}>
        <!-- an SVG stroke, not a masked gradient: the sweep is one animated dash offset and it always paints -->
        <svg class="hold-ring" class:full={st === 'ready'} viewBox="0 0 100 100" aria-hidden="true">
          <circle class="track" cx="50" cy="50" r="46" />
          <circle class="fill" cx="50" cy="50" r="46" />
        </svg>
        <div class="hold-word">{st === 'ready' ? 'Release' : 'Hold'}</div>
      </div>
    {:else if stopped != null}
      <div class="cover-time mono hi">{formatTime(stopped)}</div>
    {:else if st === 'run'}
      <div class="cover-time mono">{hideTime ? 'Solving…' : formatTime(now)}</div>
    {/if}
  </div>
{/if}
<div class="sr" aria-live="polite" aria-atomic="true">{st === 'run' ? (splits && marks.length ? (marks.length >= PHASES.length - 1 ? 'All phases marked.' : `Marked ${PHASES[marks.length - 1]}. Next: ${PHASES[marks.length]}.`) : (splits ? 'Timer running, split timing on.' : 'Timer running')) : st === 'ready' ? 'Ready, release to start' : st === 'hold' ? 'Hold' : inspActive ? 'Inspection' : tooShort ? 'Too short, not saved' : shown != null ? `Time ${formatTime(shown)}` : ''}</div>
{#if splits && st === 'run'}
  <!-- Above the cover (z-index 42): a full-screen flood is exactly where a phase mark has to be findable.
       Tapping it marks a phase; every other surface still stops the clock. The pill names the phase the
       mark will END, and its width is fixed at every mark count so nothing moves while you solve. -->
  <div class="split-dock">
    <button class="split-press" type="button" onclick={() => mark()}
      disabled={marks.length >= PHASES.length - 1}
      aria-label={marks.length >= PHASES.length - 1
        ? 'All phases marked'
        : `Mark the end of ${PHASES[marks.length]}. ${marks.length} of ${PHASES.length - 1} marks.`}>
      <span class="sp-rail" aria-hidden="true">
        <i class:on={marks.length >= 1}></i><i class:on={marks.length >= 2}></i><i class:on={marks.length >= 3}></i>
      </span>
      <span class="sp-label">{marks.length >= PHASES.length - 1 ? 'All marked' : `Next: ${PHASES[marks.length]}`}</span>
      <span class="sp-n">{marks.length}/{PHASES.length - 1}</span>
    </button>
    <button class="split-undo" type="button" onclick={() => unmark()}
      disabled={!marks.length} aria-label="Undo the last phase mark">Undo</button>
  </div>
{/if}
<button
  class="big"
  bind:this={bigEl}
  data-s={st === 'insp' ? 'idle' : st}
  style="--hold:{holdMs}ms"
  {disabled}
  aria-label="{label}. Keyboard: hold {codeLabel(store.key('timer'))}">{label}</button>

<style>
  /* Only present while the clock runs and splits are on. Dark and translucent so it stays legible on
     every cover colour (blue, gold, green, red, purple), and above the flood so it can be found at all.
     The pill is a fixed 212 px at every mark count: the dock is 286 px wide in all four states, centred,
     so nothing shifts when Undo appears or the label changes. */
  .split-dock {
    position: fixed;
    left: 50%;
    bottom: calc(96px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    z-index: 42;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .split-press {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    width: 212px;
    height: 52px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--pill-edge);
    background: var(--pill);
    color: var(--on-pill);
    font: inherit;
    font-size: 0.86rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    cursor: pointer;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transition: transform 0.12s ease;
  }
  /* three dashes: the phase marks already made, then the ones still to come */
  .sp-rail {
    display: flex;
    gap: 2px;
    flex: none;
  }
  .sp-rail i {
    display: block;
    width: 11px;
    height: 6px;
    border-radius: 3px;
    background: var(--pill-rail);
  }
  .sp-rail i.on {
    background: var(--pill-rail-on);
  }
  .sp-label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sp-n {
    font:
      800 0.74rem/1 'JetBrains Mono',
      monospace;
    opacity: 0.8;
    flex: none;
  }
  .split-undo {
    width: 58px;
    height: 52px;
    flex: none;
    border-radius: 999px;
    border: 1px solid var(--pill-edge);
    background: var(--pill);
    color: var(--on-pill);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 800;
    cursor: pointer;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transition: transform 0.12s ease;
  }
  .split-press:active:not(:disabled),
  .split-undo:active:not(:disabled) {
    transform: scale(0.95);
  }
  .split-press:disabled {
    cursor: default;
    /* the one exception to the app's dim: a solver finishing a solve still has to read "All marked" */
    opacity: 1;
  }
  .split-undo:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .split-press:focus-visible,
  .split-undo:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 3px;
  }
  @media (prefers-reduced-motion: reduce) {
    .split-press,
    .split-undo {
      transition: none;
    }
    .split-press:active:not(:disabled),
    .split-undo:active:not(:disabled) {
      transform: none;
    }
  }
</style>
