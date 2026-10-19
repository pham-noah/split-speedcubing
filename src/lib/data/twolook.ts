// Building blocks for 2-look drills. Every alg is machine-checked in twolook.test.ts.
export interface Step { name: string; alg: string }

// 2-look OLL: first orient the edges (dot, L, line), then orient the corners (7 OCLL cases).
export const EO_STEPS: Step[] = [
  { name: 'Line', alg: "F R U R' U' F'" },
  { name: 'L-shape', alg: "f R U R' U' f'" },
  { name: 'Dot', alg: "F R U R' U' F' f R U R' U' f'" },
];
export const OCLL_STEPS: Step[] = [
  { name: 'Sune', alg: "R U R' U R U2 R'" },
  { name: 'Antisune', alg: "R U2 R' U' R U' R'" },
  { name: 'H', alg: "R U R' U R U' R' U R U2 R'" },
  { name: 'Pi', alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { name: 'U', alg: "R2 D R' U2 R D' R' U2 R'" },
  { name: 'T', alg: "r U R' U' r' F R F'" },
  { name: 'L', alg: "F' r U R' U' r' F R" },
];

// 2-look PLL: first permute the corners (adjacent swap by A-perm, diagonal swap by Y-perm), then the edges.
export const CORNER_STEPS: Step[] = [
  { name: 'A-perm (adjacent corners)', alg: "R' F R' B2 R F' R' B2 R2" },
  { name: 'Y-perm (diagonal corners)', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
];
export const EDGE_STEPS: Step[] = [
  { name: 'Ua', alg: "R U' R U R U R U' R' U' R2" },
  { name: 'Ub', alg: "R2 U R U R' U' R' U' R' U R'" },
  { name: 'H', alg: "M2 U M2 U2 M2 U M2" },
  { name: 'Z', alg: "M' U M2 U M2 U M' U2 M2" },
];
