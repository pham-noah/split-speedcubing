<script lang="ts">
  import { solved, applyAlg } from '../core/cube';
  import { invert } from '../core/alg';
  import Cube3D from './Cube3D.svelte';
  import type { Slot } from '../data';

  // An F2L case as a 3D cube: everything grey, and only the two pieces the case has to join are
  // in colour. They are found by their colours, wherever they currently sit (usually the top layer),
  // not by the slot they belong to — the slot is empty in most cases.
  let { alg, slotId = 'FR', size = 60 }: { alg: string; slotId?: Slot; size?: number } = $props();

  // colour ids: 0=U 1=D 2=R 3=L 4=F 5=B
  const SIDES: Record<Slot, [number, number]> = { FR: [4, 2], FL: [4, 3], BR: [5, 2], BL: [5, 3] };
  const VIEW: Record<Slot, number> = { FR: -35, FL: 35, BR: -145, BL: 145 };

  const stickers = $derived(applyAlg(solved(), invert(alg)));
  const want = $derived.by(() => {
    const [a, b] = SIDES[slotId];
    // the pair belongs to the D layer, which is white in this app (hold white on the bottom)
    return { corner: [1, a, b].sort((x, y) => x - y).join(), edge: [a, b].sort((x, y) => x - y).join() };
  });
  const pair = $derived.by(() => {
    const groups = new Map<string, number[]>();
    for (const s of stickers) {
      const k = s.p.join(',');
      groups.set(k, [...(groups.get(k) ?? []), s.c]);
    }
    const hit = new Set<string>();
    for (const [pos, cols] of groups) {
      const sig = [...cols].sort((x, y) => x - y).join();
      if (sig === want.corner || sig === want.edge) hit.add(pos);
    }
    return hit;
  });
  const isPair = (p: [number, number, number]) => pair.has(p.join(','));

  // Keep the camera above the cube (white stays on the bottom) and only turn it around the vertical axis.
  // If even then the pair is mostly hidden, mark the two pieces in the accent colour so they can be found.
  const rotZ = (n: [number, number, number], yawDeg: number) => {
    const ry = (yawDeg * Math.PI) / 180, rx = (-26 * Math.PI) / 180;
    const [x, y, z] = n;
    const x1 = x * Math.cos(ry) + z * Math.sin(ry);
    const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
    const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
    const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
    return z2;
  };
  const view = $derived.by(() => {
    const options = [VIEW[slotId], -35, 35, -145, 145];
    let best = VIEW[slotId], bestScore = -1;
    for (const yaw of options) {
      let score = 0;
      for (const st of stickers) if (isPair(st.p) && rotZ(st.n, yaw) > 0) score++;
      if (score > bestScore) { bestScore = score; best = yaw; }
    }
    return { yaw: best, tint: bestScore < 2 };
  });
</script>

<Cube3D {stickers} {size} orbit={false} yaw={view.yaw} pitch={-26} highlight={isPair} mono={view.tint ? 'var(--am)' : null} faceCount={6} />
