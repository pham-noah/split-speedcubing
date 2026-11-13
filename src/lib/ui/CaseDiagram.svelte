<script lang="ts">
  import { applyAlg, solved, llView } from '../core/cube';
  import { invert } from '../core/alg';

  const { alg, mode = 'oll', size = 80, slot = 'FR' }: { alg: string; mode?: 'oll' | 'pll' | 'f2l'; size?: number; slot?: 'FR' | 'BR' | 'BL' | 'FL' } = $props();

  // Colours are derived from the algorithm itself (apply its inverse to a solved cube), so the picture can never disagree with the alg.
  const COL = ['#F5C542', '#F2F2F2', '#D64545', '#F08A24', '#3FA34D', '#3C6FD8'];
  const GRAY = '#4A5160';
  const st = $derived(applyAlg(solved(), invert(alg)));
  const v = $derived(llView(st));
  const fill = (c: number) => (mode === 'oll' ? (c === 0 ? COL[0] : GRAY) : COL[c]);

  // last-layer view geometry
  // S is the side-sticker band: wider than a hairline, because on PLL that band is the case (the top
  // face is uniform there, so the ring is the only colour that tells one case from another).
  const C = 28, G = 2, S = 11, O = 16;
  const pos = (i: number) => O + S + G + i * (C + G);
  const LL = O * 2 + S * 2 + G * 2 + 3 * C + 2 * G;

  // F2L view: unfolded top face plus the two side faces next to the slot, left and right. Only the slot's pair
  // (corner and edge) is shown in colour; everything else is grey.
  type P = number[];
  const FACES = {
    F: { n: [0, 0, 1], color: 4, col: (p: P) => p[0] + 1, top: (p: P) => [p[2] + 1, p[0] + 1] },
    R: { n: [1, 0, 0], color: 2, col: (p: P) => 1 - p[2], top: (p: P) => [p[0] + 1, 1 - p[2]] },
    B: { n: [0, 0, -1], color: 5, col: (p: P) => 1 - p[0], top: (p: P) => [1 - p[2], 1 - p[0]] },
    L: { n: [-1, 0, 0], color: 3, col: (p: P) => p[2] + 1, top: (p: P) => [1 - p[0], p[2] + 1] },
  } as const;
  const SLOT_FACES = { FR: ['F', 'R'], BR: ['R', 'B'], BL: ['B', 'L'], FL: ['L', 'F'] } as const;
  const lf = $derived(FACES[SLOT_FACES[slot][0]]), rf = $derived(FACES[SLOT_FACES[slot][1]]);
  const key = (p: P) => p.join(',');
  const pairCells = $derived.by(() => {
    const cornerSig = [1, lf.color, rf.color].sort().join(), edgeSig = [lf.color, rf.color].sort().join();
    const groups = new Map<string, number[]>();
    for (const s of st) groups.set(key(s.p), [...(groups.get(key(s.p)) ?? []), s.c]);
    const hit = new Set<string>();
    for (const [p, cols] of groups) {
      const sig = [...cols].sort().join();
      if (sig === cornerSig || sig === edgeSig) hit.add(p);
    }
    return hit;
  });
  const cellCol = (s: { p: P; c: number }) => (pairCells.has(key(s.p)) ? COL[s.c] : GRAY);
  const grid = (cells: (g: string[][]) => void) => { const g: string[][] = [[], [], []].map(() => Array(3).fill(GRAY)); cells(g); return g; };
  const Uf = $derived(grid(g => { for (const s of st) if (s.n[1] === 1) { const [r, c] = lf.top(s.p); g[r][c] = cellCol(s); } }));
  const sideGrid = (f: typeof lf) => grid(g => { for (const s of st) if (s.n[0] === f.n[0] && s.n[2] === f.n[2] && s.n[1] === 0) g[1 - s.p[1]][f.col(s.p)] = cellCol(s); });
  const Lf = $derived(sideGrid(lf)), Rf = $derived(sideGrid(rf));
  const K = 20, GAP = 2, M = 6;
  const FW = 3 * K + 2 * GAP;
  const panels = $derived([{ g: Uf, x: M, y: M }, { g: Lf, x: M, y: M * 2 + FW }, { g: Rf, x: M * 2 + FW, y: M * 2 + FW }]);
  // PLL is drawn as movement: an arrow from each piece's square to where it goes. Sticker i's home square
  // is where i sits solved, so no AUF is guessed. A swap is one double-headed arrow; longer cycles bow out.
  const home = solved();
  const centre = (x: number, z: number) => [pos(x + 1) + C / 2, pos(z + 1) + C / 2];
  const mid = pos(1) + C / 2;
  function arc(a: string, b: string, both: boolean) {
    const [x1, z1] = a.split(',').map(Number);
    const [x2, z2] = b.split(',').map(Number);
    const [ax, ay] = centre(x1, z1);
    const [bx, by] = centre(x2, z2);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    // push the curve away from the middle of the layer so neighbours do not overlap
    const ox = mx - mid, oy = my - mid, len = Math.hypot(ox, oy) || 1;
    const k = 16;
    const cx = mx + (ox / len) * k, cy = my + (oy / len) * k;
    const shrink = 8, dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
    const sx = ax + (dx / d) * shrink, sy = ay + (dy / d) * shrink;
    const ex = bx - (dx / d) * shrink, ey = by - (dy / d) * shrink;
    return { key: `${a}>${b}`, d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`, both };
  }
  // Some algs finish with an AUF, which would rotate every arrow. Take that rotation out: try all four,
  // keep the one that leaves a real PLL shape (no cycle longer than 3) with the fewest pieces moving.
  const rotCell = (x: number, z: number, k: number): [number, number] => {
    let a = x, b = z;
    for (let i = 0; i < ((k % 4) + 4) % 4; i++) { const t = a; a = -b; b = t; }
    return [a, b];
  };
  function cyclesOf(map: Map<string, string>) {
    const seen = new Set<string>();
    const cycles: string[][] = [];
    for (const start of map.keys()) {
      if (seen.has(start)) continue;
      const cyc: string[] = [];
      let cur: string | undefined = start;
      while (cur && !seen.has(cur)) { seen.add(cur); cyc.push(cur); cur = map.get(cur); }
      cycles.push(cyc);
    }
    return cycles;
  }
  const pllArrows = $derived.by(() => {
    if (mode !== 'pll') return [] as { key: string; d: string; both: boolean }[];
    const raw = new Map<string, [number, number]>();
    for (let i = 0; i < st.length; i++) {
      const a = st[i], b = home[i];
      if (a.n[1] !== 1) continue;
      if (a.p[0] === 0 && a.p[2] === 0) continue;
      raw.set(`${a.p[0]},${a.p[2]}`, [b.p[0], b.p[2]]);
    }
    let best: { k: number; cycles: string[][]; moving: number } | null = null;
    for (let k = 0; k < 4; k++) {
      const m = new Map<string, string>();
      for (const [from, to] of raw) {
        const [tx, tz] = rotCell(to[0], to[1], k);
        if (`${tx},${tz}` !== from) m.set(from, `${tx},${tz}`);
      }
      const cycles = cyclesOf(m);
      if (cycles.some(c => c.length > 3)) continue;          // a PLL never moves 4 pieces in a ring
      const moving = cycles.reduce((n, c) => n + c.length, 0);
      if (!best || moving < best.moving) best = { k, cycles, moving };
    }
    const cycles = best?.cycles ?? cyclesOf(new Map());
    const out: { key: string; d: string; both: boolean }[] = [];
    for (const cycle of cycles) {
      if (cycle.length === 1) continue;
      if (cycle.length === 2) { out.push(arc(cycle[0], cycle[1], true)); continue; }
      for (let k = 0; k < cycle.length; k++) out.push(arc(cycle[k], cycle[(k + 1) % cycle.length], false));
    }
    return out;
  });
  const label = $derived(
    mode === 'oll' ? `Top view, oriented stickers: ${v.top.flat().filter(c => c === 0).length} of 9 on top`
    : mode === 'pll' ? 'Top view: the coloured ring is the side of the last layer, and the arrows show which square each piece moves to'
    : 'Unfolded top, front and right faces showing the corner and edge pair to solve'
  );
</script>

{#if mode === 'f2l'}
  <svg width={size} height={size} viewBox="0 0 {M * 3 + FW * 2} {M * 3 + FW * 2}" role="img" aria-label={label}>
    {#each panels as p (p.x + '-' + p.y)}
      {#each p.g as row, r (r)}
        {#each row as c, k (k)}<rect x={p.x + k * (K + GAP)} y={p.y + r * (K + GAP)} width={K} height={K} rx="3" fill={c} />{/each}
      {/each}
    {/each}
  </svg>
{:else}
  <svg width={size} height={size} viewBox="0 0 {LL} {LL}" role="img" aria-label={label}>
    {#if mode === 'pll'}
      <defs>
        <marker id="pll-arrow" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--am)" />
        </marker>
      </defs>
      {#each [0, 1, 2] as r (r)}
        {#each [0, 1, 2] as k (k)}
          <rect x={pos(k)} y={pos(r)} width={C} height={C} rx="4" fill="#141821" stroke="#2A2F3A" stroke-width="1" />
        {/each}
      {/each}
      <!-- The ring of side stickers, in their real colours. A PLL case is read from this band: which
           corner is where, and which edge has two of the same colour next to it. -->
      {#each v.back as c, k (k)}<rect x={pos(k)} y={O} width={C} height={S} rx="3" fill={COL[c]} />{/each}
      {#each v.front as c, k (k)}<rect x={pos(k)} y={pos(2) + C + G} width={C} height={S} rx="3" fill={COL[c]} />{/each}
      {#each v.left as c, k (k)}<rect x={O} y={pos(k)} width={S} height={C} rx="3" fill={COL[c]} />{/each}
      {#each v.right as c, k (k)}<rect x={pos(2) + C + G} y={pos(k)} width={S} height={C} rx="3" fill={COL[c]} />{/each}
      {#each pllArrows as a (a.key)}
        <path d={a.d} fill="none" stroke="var(--am)" stroke-width="2" stroke-linecap="round"
          marker-end="url(#pll-arrow)" marker-start={a.both ? 'url(#pll-arrow)' : undefined} />
      {/each}
    {:else}
    {#each v.top as row, r (r)}
      {#each row as c, k (k)}
        <rect x={pos(k)} y={pos(r)} width={C} height={C} rx="4" fill={fill(c)} />
      {/each}
    {/each}
    {#each v.back as c, k (k)}<rect x={pos(k)} y={O} width={C} height={S} rx="2" fill={fill(c)} />{/each}
    {#each v.front as c, k (k)}<rect x={pos(k)} y={pos(2) + C + G} width={C} height={S} rx="2" fill={fill(c)} />{/each}
    {#each v.left as c, k (k)}<rect x={O} y={pos(k)} width={S} height={C} rx="2" fill={fill(c)} />{/each}
    {#each v.right as c, k (k)}<rect x={pos(2) + C + G} y={pos(k)} width={S} height={C} rx="2" fill={fill(c)} />{/each}
    {/if}
  </svg>
{/if}
