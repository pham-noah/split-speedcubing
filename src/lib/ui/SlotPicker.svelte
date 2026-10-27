<script lang="ts">
  import { solved } from '../core/cube';
  import Cube3D from './Cube3D.svelte';
  import { hoverEnter, hoverLeave } from './hover';
  import { SLOTS, SLOT_NAMES, type Slot } from '../data';

  // The slot filter as four small cubes: you can see which pair each slot is,
  // and only that slot's corner and edge are in colour.
  const { value, onpick }: { value: Slot; onpick: (s: Slot) => void } = $props();

  const base = solved();
  const PAIR: Record<Slot, [number, number, number][]> = {
    FR: [[1, -1, 1], [1, 0, 1]],
    FL: [[-1, -1, 1], [-1, 0, 1]],
    BR: [[1, -1, -1], [1, 0, -1]],
    BL: [[-1, -1, -1], [-1, 0, -1]],
  };
  // each cube is turned so its own pair faces you
  const VIEW: Record<Slot, number> = { FR: -35, FL: 35, BR: -145, BL: 145 };
  const pairOf = (slot: Slot) => (p: [number, number, number]) =>
    PAIR[slot].some(q => q[0] === p[0] && q[1] === p[1] && q[2] === p[2]);
</script>

<div class="slots" role="group" aria-label="F2L slot">
  {#each SLOTS as s (s)}
    <button class="slot" class:on={value === s} aria-pressed={value === s} onclick={() => onpick(s)} onpointerenter={() => hoverEnter(() => onpick(s))} onpointerleave={hoverLeave} aria-label="{SLOT_NAMES[s]} slot">
      <Cube3D stickers={base} size={52} orbit={false} yaw={VIEW[s]} highlight={pairOf(s)} />
      <span class="tag">{s}</span>
    </button>
  {/each}
</div>

<style>
  .slots { display: flex; gap: 8px; justify-content: center; }
  .slot { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 2px 6px;
    background: var(--card); border: 2px solid var(--line); border-radius: 12px; }
  .slot.on { border-color: var(--am); }
  .tag { font: 800 0.7rem "JetBrains Mono", monospace; color: var(--mu); }
  .slot.on .tag { color: var(--am); }
</style>
