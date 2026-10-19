<script lang="ts">
  import { onDestroy } from 'svelte';
  import { store } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { codeLabel } from '../core/shortcuts';
  import { formatTime, type Penalty } from '../core/stats';
  import { inspectionPenalty, inspectionText } from '../core/inspection';

  type St = 'idle' | 'insp' | 'hold' | 'ready' | 'run';
  let { twoPress = false, markLabel = 'Tap when recognized', disabled = false, holdMs = 300, hideTime = false, inspection = false, beeps = true, shown = null, cover = false, coverColor = '', onfinish }: {
    twoPress?: boolean; markLabel?: string; disabled?: boolean; holdMs?: number; hideTime?: boolean;
    inspection?: boolean; beeps?: boolean; shown?: number | null; cover?: boolean; coverColor?: string;
    onfinish: (r: { ms: number; recog: number | null; pen: Penalty }) => void;
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
  let pendingPen: Penalty = '';

  // dark ink on light covers, white on dark ones
  function readable(hex: string): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#06121F';
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.55 ? '#06121F' : '#FFFFFF';
  }
  function openCover() {
    if (!cover || !bigEl) return;
    const r = bigEl.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
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
    inspActive ? 'Hold to start' : inspection ? 'Tap to start inspection' : 'Hold to start'
  );
  const shownText = $derived(
    st === 'run' ? (hideTime ? 'Solving…' : formatTime(now)) :
    inspActive ? inspectionText(inspElapsed) : formatTime(shown)
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

  function down() {
    if (disabled) return;
    if (st === 'run') {
      if (twoPress && !marked) { recog = performance.now() - t0; marked = true; return; }
      const ms = performance.now() - t0;
      cancelAnimationFrame(raf);
      st = 'idle';
      closeCoverSoon(ms);
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
      pendingPen = pen;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    } else if (st === 'hold') {
      clearTimeout(holdTimer);
      st = inspActive ? 'insp' : 'idle';
      coverOpen = false; // let go before the timer was ready: the colour goes back down
    }
  }
  function cancel() { clearTimeout(holdTimer); cancelAnimationFrame(raf); endInspection(); st = 'idle'; clearTimeout(flashT); coverOpen = false; stopped = null; }

  // Esc / Android Back cancels an inspection or a hold instead of leaving the screen
  $effect(() => { if (inspActive || st === 'hold' || st === 'ready') return nav.onBack(() => { cancel(); return true; }); });
  onDestroy(() => { cancelAnimationFrame(raf); clearTimeout(holdTimer); audio?.close().catch(() => {}); });
  const typing = (e: Event) => /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
</script>

<svelte:window
  onkeydown={(e) => {
    if (typing(e)) return;
    if (store.is(e, 'timer')) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) down(); }
  }}
  onkeyup={(e) => { if (store.is(e, 'timer')) up(); }}
  onpointerdown={(e) => { const t = e.target as HTMLElement; if (st === 'run' ? !t.closest('nav') : !!t.closest('.big')) down(); }}
  onpointerup={up}
  onpointercancel={up}
/>

<div class="time mono" aria-hidden="true">{shownText}</div>
{#if cover}
  <div
    class="cover"
    class:on={coverOpen}
    aria-hidden="true"
    style="--cx:{cx}px;--cy:{cy}px;--cover:{coverColor || 'var(--bl)'};color:{readable(coverColor)}"
  >
    {#if stopped != null}
      <div class="cover-time mono hi">{formatTime(stopped)}</div>
    {:else if st === 'run'}
      <div class="cover-time mono">{hideTime ? 'Solving…' : formatTime(now)}</div>
    {/if}
  </div>
{/if}
<div class="sr" aria-live="polite">{st === 'run' ? 'Timer running' : st === 'ready' ? 'Ready, release to start' : st === 'hold' ? 'Hold' : inspActive ? 'Inspection' : shown != null ? `Time ${formatTime(shown)}` : ''}</div>
<button class="big" bind:this={bigEl} data-s={st === 'insp' ? 'idle' : st} {disabled} aria-label="{label}. Keyboard: hold {codeLabel(store.key('timer'))}">{label}</button>
