<script lang="ts">
  import { onDestroy } from 'svelte';
  import { solved, applyMove, applyAlg, tokens, turnInfo, parseMove, type State, type TurnInfo } from '../core/cube';
  import Cube3D from './Cube3D.svelte';

  // Walk through a scramble move by move: auto-plays while you leave it alone,
  // steps on demand when you press the arrows.
  const { alg, size = 90, autoplay = false, speed = 900, onIndex = () => {}, onClose = null }: {
    alg: string; size?: number; autoplay?: boolean; speed?: number; onIndex?: (i: number) => void; onClose?: (() => void) | null;
  } = $props();

  const moves = $derived(tokens(alg));
  let i = $state(0);
  let pos = $state<State>(solved());
  let anim = $state<TurnInfo | null>(null);
  let playing = $state(false);
  $effect(() => { playing = autoplay; });
  let touchedAt = 0;
  let busy = false;

  function seek(n: number) {
    stopTimers();
    busy = false;
    anim = null;
    // read the target position into a plain value first: reading $state here would make the
    // reset effect depend on it and undo every step
    const k = Math.max(0, Math.min(moves.length, n));
    i = k;
    pos = applyAlg(solved(), moves.slice(0, k).join(' '));
  }
  // R2 / F2 are two quarter turns, shown one after the other and a little slower than a single turn
  let dur = $state(300);
  // an animation in flight owns a timer; it must not outlive the component or a seek
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function later(fn: () => void, ms: number) {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
  }
  function stopTimers() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }
  // one move, quarter by quarter (a double move turns twice), then finish
  function animate(tok: string, finish: () => void) {
    const { m, turns } = parseMove(tok);
    const reps = Math.abs(turns);
    const one = turns < 0 ? `${m}'` : m;
    const quarter = turnInfo(one);
    dur = reps > 1 ? 430 : 300;
    busy = true;
    let done = 0;
    const run = () => {
      if (done >= reps) { anim = null; finish(); busy = false; return; }
      anim = quarter;
      later(() => {
        pos = applyMove(pos, one);
        done += 1;
        anim = null;
        if (done < reps) later(run, 60);
        else { finish(); busy = false; }
      }, dur);
    };
    run();
  }

  function step() {
    if (busy) return;
    if (i >= moves.length) { seek(0); return; }
    animate(moves[i], () => { i += 1; });
  }

  // going back plays the same move in reverse
  function back() {
    if (busy || i <= 0) return;
    const { m, turns } = parseMove(moves[i - 1]);
    const inverse = turns === 2 ? `${m}2` : turns === 1 ? `${m}'` : m;
    animate(inverse, () => { i -= 1; });
  }
  const manual = (fn: () => void) => () => { touchedAt = Date.now(); fn(); };
  // arrows drive the walkthrough itself while it is on screen (the shell's arrow navigation stands down,
  // because this listener runs in the capture phase and stops the event)
  function onKey(e: KeyboardEvent) {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault(); e.stopPropagation();
    touchedAt = Date.now();
    if (e.key === 'ArrowLeft') back();
    else if (e.key === 'ArrowRight') step();
    else if (e.key === 'ArrowUp') playing = !playing;
    else seek(0);
  }

  // it moves on its own, but waits a moment after you touch the controls
  $effect(() => {
    if (!playing) return;
    const t = setInterval(() => { if (Date.now() - touchedAt > 1600) step(); }, Math.max(300, speed));
    return () => clearInterval(t);
  });
  let lastAlg = '';
  $effect(() => {
    if (alg === lastAlg) return;
    lastAlg = alg;
    seek(0);
  });
  // the scramble line above shows the position, so the walkthrough keeps no timeline of its own
  $effect(() => { onIndex(i); });
  onDestroy(stopTimers);
</script>

<svelte:window onkeydowncapture={onKey} />

<div class="walk">
  <div class="holder"><Cube3D stickers={pos} {anim} {size} {dur} /></div>
  <div class="row" style="gap:8px;justify-content:center">
    <button class="btn" style="min-width:56px" aria-label="Previous move" onclick={manual(back)}>‹</button>
    <button class="btn" style="min-width:96px" onclick={manual(() => (playing = !playing))}>{playing ? 'Pause' : 'Play'}</button>
    <button class="btn" style="min-width:56px" aria-label="Next move" onclick={manual(step)}>›</button>
    <button class="btn" style="min-width:72px" aria-label="Start again" onclick={manual(() => seek(0))}>↺</button>
    {#if onClose}<button class="btn" onclick={onClose} aria-label="Hide the cube">Hide</button>{/if}
  </div>
</div>

<style>
  .walk { display: flex; flex-direction: column; gap: 12px; align-items: center; }
  .holder { padding: 6px 0 2px; line-height: 0; }
</style>
