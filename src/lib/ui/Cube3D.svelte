<script lang="ts">
  import type { State, TurnInfo } from '../core/cube';
  import { store } from '../store.svelte';
  import { DEFAULT_CUBE_COLORS } from './cube-colors';

  // A CSS-3D cube drawn straight from the sticker state, so it can never disagree with the simulator.
  let { stickers, anim = null, size = 200, highlight = null, orbit = true, yaw = -34, pitch = -26, mono = null, dur = 300, faceCount = 6 }: {
    stickers: State; anim?: TurnInfo | null; size?: number; orbit?: boolean; yaw?: number; pitch?: number;
    highlight?: ((p: [number, number, number]) => boolean) | null; mono?: string | null; dur?: number; faceCount?: 3 | 6;
  } = $props();

  // colours follow the settings; swapping red and orange is a display swap, the simulator is untouched
  const COL = $derived.by(() => {
    const s = store.data.settings;
    const base = s.cubeColors && s.cubeColors.length === 6 ? s.cubeColors : DEFAULT_CUBE_COLORS;
    return s.swapRO ? [base[0], base[1], base[3], base[2], base[4], base[5]] : base;
  });
  const DARK = '#2A2F3A';
  const U = $derived(size / 3);

  type Cubie = { p: [number, number, number]; faces: Record<string, number> };
  const cubies = $derived.by(() => {
    const m = new Map<string, Cubie>();
    for (const s of stickers) {
      const k = s.p.join(',');
      let c = m.get(k);
      if (!c) { c = { p: s.p as [number, number, number], faces: {} }; m.set(k, c); }
      c.faces[s.n.join(',')] = s.c;
    }
    return [...m.values()];
  });

  // CSS has y pointing down while the simulator has y pointing up: a mirrored frame flips the angle
  const turn = $derived.by(() => {
    if (!anim) return null;
    const axis = anim.axis === 0 ? '1,0,0' : anim.axis === 1 ? '0,-1,0' : '0,0,1';
    return { axis, angle: -(anim.quarter * 90 * Math.abs(anim.turns)) };
  });

  // which three faces point at the camera for this fixed view
  const visible = $derived.by(() => {
    if (faceCount === 6) return null;
    const rx = (pitch * Math.PI) / 180, ry = (yaw * Math.PI) / 180;
    const rot = (n: [number, number, number]): [number, number, number] => {
      const [x, y, z] = n;
      // CSS applies rotateX(pitch) rotateY(yaw) right to left: yaw first, then pitch
      const x1 = x * Math.cos(ry) + z * Math.sin(ry);
      const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
      const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      return [x1, y2, z2];
    };
    return new Set(
      [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]
        .filter(n => rot(n as [number, number, number])[2] > 0)
        .map(n => n.join(',')),
    );
  });

  // with a fixed three-face view, cubies that only show hidden faces are never seen: skip them
  const drawn = $derived(visible ? cubies.filter(c => Object.keys(c.faces).some(n => visible.has(n))) : cubies);

  let spinX = $state(0);
  let spinY = $state(0);   // drag adds to the given viewing angle
  let drag: { x: number; y: number } | null = null;

  const facesOf = (u: number) => [
    { n: '0,0,1', t: `translateZ(${u / 2}px)` },
    { n: '0,0,-1', t: `rotateY(180deg) translateZ(${u / 2}px)` },
    { n: '1,0,0', t: `rotateY(90deg) translateZ(${u / 2}px)` },
    { n: '-1,0,0', t: `rotateY(-90deg) translateZ(${u / 2}px)` },
    { n: '0,1,0', t: `rotateX(90deg) translateZ(${u / 2}px)` },
    { n: '0,-1,0', t: `rotateX(-90deg) translateZ(${u / 2}px)` },
  ];
</script>

<div
  class="stage" class:lite={size <= 60}
  style="width:{Math.round(size * 1.5)}px;height:{Math.round(size * 1.4)}px"
  role="img"
  aria-label="Cube position, drawn from the same moves as the scramble"
  onpointerdown={(e) => { if (!orbit) return; drag = { x: e.clientX - spinY, y: e.clientY - spinX }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
  onpointermove={(e) => { if (!orbit || !drag) return; spinY = e.clientX - drag.x; spinX = e.clientY - drag.y; }}
  onpointerup={() => (drag = null)}
  onpointercancel={() => (drag = null)}
>
  <div class="cube" style="transform:rotateX({pitch + spinX}deg) rotateY({yaw + spinY}deg);width:{size}px;height:{size}px;position:absolute;left:50%;top:50%;margin-left:{-size / 2}px;margin-top:{-size / 2}px">
    {#each drawn as c (c.p.join(','))}
      {@const inLayer = anim ? anim.test(c.p as [number, number, number]) : false}
      <div
        class="cubie"
        style="width:{U}px;height:{U}px;margin:{-U / 2}px 0 0 {-U / 2}px;
          transform:{turn && inLayer ? `rotate3d(${turn.axis},${turn.angle}deg) ` : ''}translate3d({c.p[0] * U}px,{-c.p[1] * U}px,{c.p[2] * U}px);
          transition:{turn && inLayer ? `transform ${dur}ms cubic-bezier(.3,.7,.4,1)` : 'none'}"
      >
        {#each facesOf(U).filter(f => !visible || visible.has(f.n)) as f (f.n)}
          {@const inPair = !highlight || highlight(c.p as [number, number, number])}
          {@const col = !inPair ? null : mono ? mono : c.faces[f.n]}
          <div class="face" style="transform:{f.t};background:{col == null ? DARK : typeof col === 'string' ? col : COL[col]};opacity:{col == null ? .55 : 1}"></div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .stage { position: relative; perspective: 900px; touch-action: none; cursor: grab; user-select: none; }
  .stage:active { cursor: grabbing; }
  .cube { transform-style: preserve-3d; }
  .cubie { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
  .face { position: absolute; inset: 0; border-radius: 8px; border: 1px solid #0B0D11; backface-visibility: hidden; }
  .stage { filter: drop-shadow(0 6px 14px rgba(0,0,0,.55)); }
  .stage.lite { filter: none; }
</style>
