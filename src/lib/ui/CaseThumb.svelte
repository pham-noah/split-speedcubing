<script lang="ts">
  import { solved, applyAlg } from '../core/cube';
  import { invert } from '../core/alg';
  import { store } from '../store.svelte';
  import { DEFAULT_CUBE_COLORS } from './cube-colors';
  import { thumbQuads } from './caseCubeView';
  import type { Slot } from '../data';

  // An F2L case as a flat drawing: the three faces a fixed camera can see, drawn as SVG quads from the
  // same sticker state and the same projection CaseCube uses in 3D. The Library grid holds 41 of these at
  // once, so it must not be 41 live CSS-3D scenes: one <svg> with 27 <polygon>s paints in a single pass.
  const { alg, slotId = 'FR', size = 60 }: { alg: string; slotId?: Slot; size?: number } = $props();

  const DARK = '#2A2F3A';
  const COL = $derived.by(() => {
    const s = store.data.settings;
    const base = s.cubeColors && s.cubeColors.length === 6 ? s.cubeColors : DEFAULT_CUBE_COLORS;
    return s.swapRO ? [base[0], base[1], base[3], base[2], base[4], base[5]] : base;
  });
  const accent = $derived(getComputedStyle(document.documentElement).getPropertyValue('--am').trim() || '#e3b84e');

  const stickers = $derived(applyAlg(solved(), invert(alg)));
  const drawing = $derived(thumbQuads(stickers, slotId, size, COL as string[], DARK, accent));
</script>

<svg
  width={size + 4} height={size + 4} viewBox={`-2 -2 ${size + 4} ${size + 4}`}
  role="img" aria-label="The two pieces this case has to join, drawn from the same moves as the scramble"
  class="thumb"
>
  {#each drawing.quads as q (q.key)}
    <polygon points={q.points} fill={q.fill} fill-opacity={q.dim ? 0.55 : 1} stroke="#0B0D11" stroke-width="0.6" />
  {/each}
</svg>

<style>
  .thumb { display: block; }
</style>
