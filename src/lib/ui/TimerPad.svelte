<script lang="ts">
  import { onDestroy } from 'svelte';
  import { store } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { codeLabel } from '../core/shortcuts';
  import { formatTime, type Penalty } from '../core/stats';
  import { inspectionPenalty, inspectionText } from '../core/inspection';
  import { readableInk } from './color';

  type St = 'idle' | 'insp' | 'hold' | 'ready' | 'run';
  const { twoPress = false, markLabel = 'Tap when recognized', disabled = false, holdMs = 300, tapStart = false, hideTime = false, inspection = false, beeps = true, shown = null, cover = false, coverColor = '', onfinish, onRunning }: {
    twoPress?: boolean; markLabel?: string; disabled?: boolean; holdMs?: number; tapStart?: boolean; hideTime?: boolean;
    inspection?: boolean; beeps?: boolean; shown?: number | null; cover?: boolean; coverColor?: string;
    onfinish: (r: { ms: number; recog: number | null; pen: Penalty }) => void;
    onRunning?: (running: boolean) => void;
  } = $props();

  let st = $state<St>('idle');
  let now = $state(0);          // elapsed ms of the solve
  let inspElapsed = $state(0);  // elapsed ms of inspection
  let inspActive = $state(false);
  let marked = $state(false);
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

  function down() {
    if (disabled) return;
    if (st === 'run') {
      if (twoPress && !marked) { recog = performance.now() - t0; marked = true; return; }
      const ms = performance.now() - t0;
      cancelAnimationFrame(raf);
      st = 'idle';
      closeCoverSoon(ms);
      letSleep();
      onfinish({ ms, recog, pen: pendingPen });
      pendingPen = '';
      return;
    }
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
        st = 'run'; marked = false; recog = null; t0 = performance.now(); now = 0; pendingPen = pen; keepAwake();
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
      st = 'run'; marked = false; recog = null; t0 = performance.now(); now = 0;
      pendingPen = pen; keepAwake();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    } else if (st === 'hold') {
      clearTimeout(holdTimer);
      st = inspActive ? 'insp' : 'idle';
      coverOpen = false; // let go before the timer was ready: the colour goes back down
    }
  }
  function cancel() { clearTimeout(holdTimer); cancelAnimationFrame(raf); endInspection(); st = 'idle'; clearTimeout(flashT); coverOpen = false; stopped = null; letSleep(); }

  // Esc / Android Back cancels the timer instead of leaving the screen, including a solve in progress
  $effect(() => { if (inspActive || st === 'hold' || st === 'ready' || st === 'run') return nav.onBack(() => { cancel(); return true; }); });
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
    if (store.is(e, 'timer')) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) down(); }
  }}
  onkeyup={(e) => { if (store.is(e, 'timer')) up(); }}
  onpointerdown={(e) => { if (e.button !== 0) return; const t = e.target as HTMLElement; if (st === 'run' ? !t.closest('nav') : !!t.closest('.big')) down(); }}
  onpointerup={up}
  onpointercancel={up}
/>

<div class="time mono" class:done={st === 'idle' && shown != null} aria-hidden="true">{shownText}</div>
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
<div class="sr" aria-live="polite">{st === 'run' ? 'Timer running' : st === 'ready' ? 'Ready, release to start' : st === 'hold' ? 'Hold' : inspActive ? 'Inspection' : shown != null ? `Time ${formatTime(shown)}` : ''}</div>
<button
  class="big"
  bind:this={bigEl}
  data-s={st === 'insp' ? 'idle' : st}
  style="--hold:{holdMs}ms"
  {disabled}
  aria-label="{label}. Keyboard: hold {codeLabel(store.key('timer'))}">{label}</button>
