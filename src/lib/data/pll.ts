import type { CaseDef } from './types';

// The 21 PLL cases in the standard letter naming, from speedcubedb.com/a/3x3/PLL (fetched 2026-10-30): the
// algorithm that page marks standard plus up to three more that solve it. Regenerate with
// scripts/gen-lastlayer-scdb.ts.
export const PLL: CaseDef[] = [
  { id: "PLL-Aa", set: 'PLL', name: "Aa-perm", alg: "x R' U R' D2 R U' R' D2 R2 x'", alts: ["l' U R' D2 R U' R' D2 R2 x'"] },
  { id: "PLL-Ab", set: 'PLL', name: "Ab-perm", alg: "x R2 D2 R U R' D2 R U' R x'", alts: ["R' B' R U' R D R' U R D' R2 B R"] },
  { id: "PLL-E", set: 'PLL', name: "E-perm", alg: "y x' R U' R' D R U R' D' R U R' D R U' R' D' x", alts: ["y R' U' R' D' R U' R' D R U R' D' R U R' D R2"] },
  { id: "PLL-F", set: 'PLL', name: "F-perm", alg: "y R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", alts: ["y R' F R f' R' F R2 U R' U' R' F' R2 U R' S", "y R2 F R F' R' U' F' U F R2 U R' U' R"] },
  { id: "PLL-Ga", set: 'PLL', name: "Ga-perm", alg: "R2 U R' U R' U' R U' R2 D U' R' U R D'", alts: ["R2 u R' U R' U' R u' R2 F' U F", "D' R2 U R' U R' U' R U' R2 U' D R' U R"] },
  { id: "PLL-Gb", set: 'PLL', name: "Gb-perm", alg: "R' U' R U D' R2 U R' U R U' R U' R2 D", alts: ["D R' U' R U D' R2 U R' U R U' R U' R2"] },
  { id: "PLL-Gc", set: 'PLL', name: "Gc-perm", alg: "R2 U' R U' R U R' U R2 D' U R U' R' D", alts: ["D R2 U' R U' R U R' U R2 D' U R U' R'", "R2 u' R U' R U R' u R2 f R' f'"] },
  { id: "PLL-Gd", set: 'PLL', name: "Gd-perm", alg: "R U R' U' D R2 U' R U' R' U R' U R2 D'", alts: ["D' R U R' U' D R2 U' R U' R' U R' U R2"] },
  { id: "PLL-H", set: 'PLL', name: "H-perm", alg: "M2 U' M2 U2 M2 U' M2", alts: ["M2 U M2 U2 M2 U M2", "R2 S2 R2 U' R2 S2 R2", "M2 U2 M2 U M2 U2 M2"] },
  { id: "PLL-Ja", set: 'PLL', name: "Ja-perm", alg: "y R' U L' U2 R U' R' U2 R L" },
  { id: "PLL-Jb", set: 'PLL', name: "Jb-perm", alg: "R U R' F' R U R' U' R' F R2 U' R'", alts: ["R U2 R' U' R U2 L' U R' U' L", "r' F R F' r U2 R' U R U2 R'", "L' U R U' L U2 R' U R U2 R'"] },
  { id: "PLL-Na", set: 'PLL', name: "Na-perm", alg: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", alts: ["F' R U R' U' R' F R2 F U' R' U' R U F' R'", "R F U' R' U R U F' R2 F' R U R U' R' F", "r' D r U2 r' D r U2 r' D r U2 r' D r U2 r' D r"] },
  { id: "PLL-Nb", set: 'PLL', name: "Nb-perm", alg: "R' U R U' R' F' U' F R U R' F R' F' R U' R", alts: ["r' D' F r U' r' F' D r2 U r' U' r' F r F'", "R' U L' U2 R U' L R' U L' U2 R U' L", "R' U R U' R' F' U' F R U R' U' R U' f R f'"] },
  { id: "PLL-Ra", set: 'PLL', name: "Ra-perm", alg: "y R U' R' U' R U R D R' U' R D' R' U2 R'", alts: ["y R U R' F' R U2 R' U2 R' F R U R U2 R'", "y R U' R' U' R U R' U R' D' R U' R' D R2 U R'"] },
  { id: "PLL-Rb", set: 'PLL', name: "Rb-perm", alg: "R' U2 R U2 R' F R U R' U' R' F' R2", alts: ["R' U2 R' D' R U' R' D R U R U' R' U' R"] },
  { id: "PLL-T", set: 'PLL', name: "T-perm", alg: "R U R' U' R' F R2 U' R' U' R U R' F'", alts: ["R U R' U' R' F R2 U' R' U F' L' U L", "R2 u R2 u' R2 F2 u' F2 u F2"] },
  { id: "PLL-Ua", set: 'PLL', name: "Ua-perm", alg: "y2 M2 U M U2 M' U M2", alts: ["y2 R U' R U R U R U' R' U' R2"] },
  { id: "PLL-Ub", set: 'PLL', name: "Ub-perm", alg: "y2 M2 U' M U2 M' U' M2", alts: ["y2 R2 U R U R' U' R' U' R' U R'"] },
  { id: "PLL-V", set: 'PLL', name: "V-perm", alg: "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2", alts: ["R' U R U' R' f' U' R U2 R' U' R U' R' f R"] },
  { id: "PLL-Y", set: 'PLL', name: "Y-perm", alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'", alts: ["F R' F R2 U' R' U' R U R' F' R U R' U' F'", "R2 U' R2 U' R2 U F U F' R2 F U' F'", "F R' F' R U R U' R2 U' R U R f' U' f"] },
  { id: "PLL-Z", set: 'PLL', name: "Z-perm", alg: "M2 U M2 U M' U2 M2 U2 M'", alts: ["M' U' M2 U' M2 U' M' U2 M2"] },
];
