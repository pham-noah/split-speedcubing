import type { CaseDef } from './types';
const p = (name: string, alg: string): CaseDef => ({ id: `PLL-${name}`, set: 'PLL', name: `${name}-perm`, alg });
// Starting algs. Each is machine-checked in cases.test.ts (valid PLL, distinct case), but
// check them against your own preferred algs and change them in the Library.
export const PLL: CaseDef[] = [
  p('Aa', "R' F R' B2 R F' R' B2 R2"),
  p('Ab', "R B' R F2 R' B R F2 R2"),
  p('E', "R B' R' F R B R' F' R B R' F R B' R' F'"),
  p('F', "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"),
  p('Ga', "R2 U R' U R' U' R U' R2 U' D R' U R D'"),
  p('Gb', "R' U' R U D' R2 U R' U R U' R U' R2 D"),
  p('Gc', "R2 U' R U' R U R' U R2 D' U R U' R' D"),
  p('Gd', "R U R' U' D R2 U' R U' R' U R' U R2 D'"),
  p('H', "M2 U M2 U2 M2 U M2"),
  p('Ja', "R' U L' U2 R U' R' U2 R L"),
  p('Jb', "R U R' F' R U R' U' R' F R2 U' R'"),
  p('Na', "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"),
  p('Nb', "R' U R U' R' F' U' F R U R' F R' F' R U' R"),
  p('Ra', "R U' R' U' R U R D R' U' R D' R' U2 R'"),
  p('Rb', "R' U2 R U2 R' F R U R' U' R' F' R2"),
  p('T', "R U R' U' R' F R2 U' R' U' R U R' F'"),
  p('Ua', "R U' R U R U R U' R' U' R2"),
  p('Ub', "R2 U R U R' U' R' U' R' U R'"),
  p('V', "R' U R' U' y R' F' R2 U' R' U R' F R F"),
  p('Y', "F R U' R' U' R U R' F' R U R' U' R' F R F'"),
  p('Z', "M' U M2 U M2 U M' U2 M2"),
];
