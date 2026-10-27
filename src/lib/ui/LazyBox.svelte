<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  // Mounts its children only when the box comes near the viewport, so a 41-cube grid does not
  // build every cube up front. The cell keeps its size, so nothing moves.
  const { width, height, children }: { width: number; height: number; children: Snippet } = $props();
  let el: HTMLElement | undefined = $state();
  let show = $state(false);

  onMount(() => {
    if (!el) return;
    // very old webviews have no IntersectionObserver: show the cube rather than never drawing it
    if (typeof IntersectionObserver === 'undefined') { show = true; return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { show = true; io.disconnect(); }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  });
</script>

<div bind:this={el} style="width:{width}px;height:{height}px">
  {#if show}{@render children()}{/if}
</div>
