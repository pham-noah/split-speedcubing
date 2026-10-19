<script lang="ts">
  import { onMount } from 'svelte';
  import { nav } from '../nav.svelte';
  let { onDone }: { onDone: () => void } = $props();

  const slides = [
    { title: 'Welcome to Split', body: 'Split is a speedcubing timer and algorithm trainer that works completely offline. Your solves and progress stay on this device: no account, no tracking.' },
    { title: 'Time solves, train cases', body: 'Use the middle Solve button for normal timing. In Train, practise PLL, OLL, F2L and ZBLL cases: press once when you recognise the case and again when you finish, and the app schedules each case for review right before you would forget it.' },
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
  // keep keyboard focus inside the dialog
  function trap(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const f = [...dialog.querySelectorAll<HTMLElement>('button')];
    const first = f[0], end = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
    else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title" bind:this={dialog} onkeydown={trap} tabindex="-1">
  <div class="sheet">
    <div style="font-size:.9rem;font-weight:700;color:var(--mu)" aria-live="polite">Step {i + 1} of {slides.length}</div>
    {#if i === 0}<img src="./logo.png" width="112" height="112" alt="" style="align-self:center" />{/if}
    <h2 id="intro-title">{slides[i].title}</h2>
    <p>{slides[i].body}</p>
    <div class="dots" aria-hidden="true">{#each slides as _, k}<i class:on={k === i}></i>{/each}</div>
    <div class="row">
      {#if !last}<button class="btn" onclick={onDone}>Skip</button>{/if}
      <button class="btn p" data-first onclick={() => (last ? onDone() : i++)}>{last ? 'Get started' : 'Next'}</button>
    </div>
  </div>
</div>
