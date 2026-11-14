<script lang="ts">
  // The app's single refusal line. It says why a control did nothing, sits above the nav and the split
  // dock, and takes itself away: repeated taps restart the message instead of stacking a queue.
  const { msg, onDone }: { msg: string; onDone: () => void } = $props();
  $effect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  });
</script>

<div class="toast" role="status" aria-live="polite">{msg}</div>

<style>
  .toast {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(66px + env(safe-area-inset-bottom, 0px));
    z-index: 60;
    white-space: nowrap;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 9px 14px;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--tx);
    box-shadow: 0 10px 30px -12px #000;
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      transition: none;
    }
  }
</style>
