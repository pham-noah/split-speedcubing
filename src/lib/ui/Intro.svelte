<script lang="ts">
  import { onMount } from 'svelte';
  import { nav } from '../nav.svelte';
  import { PHASES } from '../core/stats';
  const { onDone }: { onDone: () => void } = $props();

  const slides = [
    { title: 'Welcome to Split', body: 'Split is a speedcubing timer and algorithm trainer that works completely offline. Your solves and progress stay on this device: no account, no tracking.' },
    { title: 'Time solves, train cases', body: 'Use the middle Solve button for normal timing. In Train, practise PLL, OLL, F2L and ZBLL cases: press once when you recognise the case and again when you finish, and the app schedules each case for review right before you would forget it.' },
    { title: 'Split a solve into phases', body: 'Turn on split timing, then tap Split once per phase while the clock runs. Cross, F2L, OLL, PLL. Afterwards Split remembers your worst phase and offers a drill for it.' },
    { title: 'Make it yours', body: 'Change algorithms, keyboard shortcuts, themes and text size in Settings. Import your old solves from csTimer, and export a backup any time, since nothing is stored in the cloud.' },
  ];
  let i = $state(0);
  let dialog: HTMLElement;
  const last = $derived(i === slides.length - 1);

  onMount(() => {
    // Back (Android button or Esc) skips the intro instead of leaving the app
    const off = nav.onBack(() => { onDone(); return true; });
    dialog.querySelector<HTMLElement>('[data-first]')?.focus();
    return off;
  });
  // ArrowLeft is Back. System Back keeps doing what it did (skip the intro).
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); i--; return; }
    if (e.key === 'Tab') trap(e);
  }
  // Keep keyboard focus inside the dialog — and off the disabled Back button on slide 1, which is not
  // focusable, so it must not be counted as the first stop (otherwise Tab from Next lands on nothing).
  function trap(e: KeyboardEvent) {
    const f = [...dialog.querySelectorAll<HTMLElement>('button')].filter((b) => !b.hasAttribute('disabled'));
    const first = f[0], end = f[f.length - 1];
    if (!end) return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
    else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
  }
</script>

<!-- ArrowLeft is Back, caught at the window: a programmatic slide change can leave focus on the body, and
     a keydown on the body never reaches a handler on the dialog. App's own key handler returns early
     while the intro is open, so this is the only listener. -->
<svelte:window onkeydown={key} />

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title" bind:this={dialog} tabindex="-1">
  <div class="sheet">
    <div style="font-size:.9rem;font-weight:700;color:var(--mu)" aria-live="polite">Step {i + 1} of {slides.length}</div>
    {#if i === 0}<img src="./logo.png" width="112" height="112" alt="" style="align-self:center" />{/if}
    <h2 id="intro-title">{slides[i].title}</h2>
    <p>{slides[i].body}</p>
    {#if i === 2}
      <!-- the same bar Solve draws, so the reader sees what they are about to turn on -->
      <div style="display:flex;flex-direction:column;gap:6px" aria-hidden="true">
        <div class="phbar">
          <span style="flex:1;opacity:1"></span><span style="flex:1;opacity:.81"></span>
          <span style="flex:1;opacity:.62"></span><span style="flex:1;opacity:.43"></span>
        </div>
        <div class="phrow" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:0">
          {#each PHASES as p (p)}<div class="ph-l">{p}</div>{/each}
        </div>
      </div>
    {/if}
    <div class="dots" aria-hidden="true">{#each slides as _, k (k)}<i class:on={k === i}></i>{/each}</div>
    <div class="intro-foot">
      <button class="btn" disabled={i === 0} onclick={() => i--}>Back</button>
      {#if !last}<button class="btn" onclick={onDone}>Skip</button>{/if}
      <button class="btn p" data-first onclick={() => (last ? onDone() : i++)}>{last ? 'Get started' : 'Next'}</button>
    </div>
  </div>
</div>

<style>
  /* The sheet holds a fixed footprint and the footer sits at its bottom, so the primary button's box is
     identical on all four slides: the logo and the phase bar change the content, never the frame. */
  .sheet {
    min-height: min(560px, 100%);
  }
  /* Three cells, so the primary never moves whichever of Back/Skip sits beside it. The last cell is
     wider than the other two: at 130 % on a 360 px screen "Get started" does not fit a third of the
     sheet, and a wrapped label would make the row taller and move the button anyway. */
  .intro-foot {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr);
    gap: 8px;
    min-height: 44px;
    align-items: stretch;
    margin-top: auto;
  }
  .intro-foot > .btn {
    min-height: 44px;
    min-width: 0;
    padding: 0 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .intro-foot > .btn:last-child {
    grid-column: 3;
  }
</style>
