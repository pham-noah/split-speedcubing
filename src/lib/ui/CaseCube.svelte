<script lang="ts">
  import { solved, applyAlg } from '../core/cube';
  import { invert } from '../core/alg';
  import Cube3D from './Cube3D.svelte';
  import type { Slot } from '../data';
  import { chooseView } from './caseCubeView';

  // An F2L case as a 3D cube: everything grey, and only the two pieces the case has to join are
  // in colour. They are found by their colours, wherever they currently sit (usually the top layer),
  // not by the slot they belong to — the slot is empty in most cases.
  const { alg, slotId = 'FR', size = 60 }: { alg: string; slotId?: Slot; size?: number } = $props();

  // the pair, the framing and the projection all live in ./caseCubeView so CaseThumb (flat SVG in the
  // Library grid) and this 3D scene can never disagree about which pieces a case is about
  const stickers = $derived(applyAlg(solved(), invert(alg)));
  const view = $derived(chooseView(stickers, slotId));
  const pair = $derived(view.pair);
  const isPair = (p: [number, number, number]) => pair.has(p.join(','));
</script>

<Cube3D {stickers} {size} orbit={false} yaw={view.yaw} pitch={-26} highlight={isPair} mono={view.tint ? 'var(--am)' : null} />
