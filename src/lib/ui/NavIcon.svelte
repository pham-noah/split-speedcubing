<script lang="ts">
  // Small inline icons for the tab bar: no icon library, no network, and they inherit the tab colour.
  const { name, size = 22 }: { name: 'train' | 'library' | 'drills' | 'settings'; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  {#if name === 'train'}
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="3.4" />
  {:else if name === 'library'}
    {#each [3.5, 10, 16.5] as y (y)}
      {#each [3.5, 10, 16.5] as x (x)}
        <rect x={x} y={y} width="4" height="4" rx="1.1" />
      {/each}
    {/each}
  {:else if name === 'drills'}
    <circle cx="12" cy="13.5" r="6.8" />
    <path d="M12 10.5v3.4l2.2 1.4" />
    <path d="M9.4 3h5.2" />
    <path d="M12 3v3" />
  {:else}
    <path d="M4 7h9M18.5 7H20M4 12h3.5M12.5 12H20M4 17h9M18.5 17H20" />
    <circle cx="15.7" cy="7" r="2.1" />
    <circle cx="9.7" cy="12" r="2.1" />
    <circle cx="15.7" cy="17" r="2.1" />
  {/if}
</svg>
