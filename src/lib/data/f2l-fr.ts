import type { CaseDef } from './types';

// The 41 standard first-two-layers cases, in the community's numbering, taken from SpeedCubeDB
// (https://speedcubedb.com/a/3x3/F2L, front-right slot, fetched 2026-10-30). Each case ships the
// highest-voted algorithm that the simulator accepts for this slot, plus up to three further
// algorithms from the same page that solve it. Regenerate with scripts/gen-f2l-scdb.ts, which
// re-checks every line before writing this file.
export const F2L_GROUPS = ["Free Pairs","Disconnected Pairs","Connected Pairs","Corner In Slot","Edge In Slot","Pieces In Slot"];

export const F2L_FR: CaseDef[] = [
  { id: 'F2L-1', set: 'F2L', name: 'F2L 1', alg: "U R U' R'", group: "Free Pairs", slot: 'FR', alts: ["R' F R F'"] },
  { id: 'F2L-2', set: 'F2L', name: 'F2L 2', alg: "F R' F' R", group: "Free Pairs", slot: 'FR', alts: ["U' F' U F"] },
  { id: 'F2L-3', set: 'F2L', name: 'F2L 3', alg: "F' U' F", group: "Free Pairs", slot: 'FR', alts: ["S U R U' R' S'"] },
  { id: 'F2L-4', set: 'F2L', name: 'F2L 4', alg: "R U R'", group: "Free Pairs", slot: 'FR' },
  { id: 'F2L-5', set: 'F2L', name: 'F2L 5', alg: "U' R U R' U2 R U' R'", group: "Disconnected Pairs", slot: 'FR', alts: ["F2 L' U' L U F2", "U' R U R' U' R U2 R'", "U' R U R' U R' F R F'"] },
  { id: 'F2L-6', set: 'F2L', name: 'F2L 6', alg: "U' r U' R' U R U r'", group: "Disconnected Pairs", slot: 'FR' },
  { id: 'F2L-7', set: 'F2L', name: 'F2L 7', alg: "U' R U2 R' U' R U2 R'", group: "Disconnected Pairs", slot: 'FR', alts: ["M' U' M U2 r U' r'", "U' R U2 R' U2 R U' R'", "U' R U2 R' U R' F R F'"] },
  { id: 'F2L-8', set: 'F2L', name: 'F2L 8', alg: "r' U2 R2 U R2 U r", group: "Disconnected Pairs", slot: 'FR' },
  { id: 'F2L-9', set: 'F2L', name: 'F2L 9', alg: "U' R U' R' U F' U' F", group: "Disconnected Pairs", slot: 'FR', alts: ["F R U R' U' F' R U' R'"] },
  { id: 'F2L-10', set: 'F2L', name: 'F2L 10', alg: "U' R U R' U R U R'", group: "Disconnected Pairs", slot: 'FR', alts: ["U2 R U' R' U' R U R'", "d R' U R d' R U R'"] },
  { id: 'F2L-11', set: 'F2L', name: 'F2L 11', alg: "U' R U2 R' U F' U' F", group: "Connected Pairs", slot: 'FR', alts: ["F' U L' U2 L U2 F"] },
  { id: 'F2L-12', set: 'F2L', name: 'F2L 12', alg: "R U' R' U R U' R' U2 R U' R'", group: "Connected Pairs", slot: 'FR', alts: ["R' U2 R2 U R2 U R", "U F' U2 F U' R U R'", "U R U' R' U' R U R' U' R U R'"] },
  { id: 'F2L-13', set: 'F2L', name: 'F2L 13', alg: "M' U' R U R' U2 R U' r'", group: "Connected Pairs", slot: 'FR', alts: ["R U' R' U R' F R F' R U' R'"] },
  { id: 'F2L-14', set: 'F2L', name: 'F2L 14', alg: "U' R U' R' U R U R'", group: "Connected Pairs", slot: 'FR', alts: ["R U2 R' U2 R U R' U2 R U' R'", "U' R2 D R' U R D' R2", "U2 R2 U R' U R U2 R2"] },
  { id: 'F2L-15', set: 'F2L', name: 'F2L 15', alg: "M U r U' r' U' M'", group: "Connected Pairs", slot: 'FR', alts: ["R U R' U2 R U' R' U R U' R'", "R' D' R U' R' D R U R U' R'", "F' U F U2 R U R'"] },
  { id: 'F2L-16', set: 'F2L', name: 'F2L 16', alg: "R U' R' U2 F' U' F", group: "Connected Pairs", slot: 'FR', alts: ["U M' U R U' r' U' R U R'", "U F U R U' R' F' R U R'"] },
  { id: 'F2L-17', set: 'F2L', name: 'F2L 17', alg: "R U2 R' U' R U R'", group: "Connected Pairs", slot: 'FR', alts: ["R U R' U' R U2 R' U2 R U R'"] },
  { id: 'F2L-18', set: 'F2L', name: 'F2L 18', alg: "F' U2 F U F' U' F", group: "Connected Pairs", slot: 'FR', alts: ["R' F R F' R U' R' U R U' R'"] },
  { id: 'F2L-19', set: 'F2L', name: 'F2L 19', alg: "U R U2 R' U R U' R'", group: "Disconnected Pairs", slot: 'FR', alts: ["U R U2 R2 F R F'", "R U' R' U R U' R' U R U R'"] },
  { id: 'F2L-20', set: 'F2L', name: 'F2L 20', alg: "U' R U' R2 F R F' R U' R'", group: "Disconnected Pairs", slot: 'FR', alts: ["U' F' U2 F U' F' U F"] },
  { id: 'F2L-21', set: 'F2L', name: 'F2L 21', alg: "U2 R U R' U R U' R'", group: "Disconnected Pairs", slot: 'FR', alts: ["R U' R' U2 R U R'", "R B U2 B' R'"] },
  { id: 'F2L-22', set: 'F2L', name: 'F2L 22', alg: "r U' r' U2 r U r'", group: "Disconnected Pairs", slot: 'FR', alts: ["F' L' U2 L F"] },
  { id: 'F2L-23', set: 'F2L', name: 'F2L 23', alg: "U R U' R' U' R U' R' U R U' R'", group: "Connected Pairs", slot: 'FR', alts: ["R U R' U2 R U R' U' R U R'", "U2 R2 U2 R' U' R U' R2", "R U' R2 D' R U2 R' D R"] },
  { id: 'F2L-24', set: 'F2L', name: 'F2L 24', alg: "F U R U' R' F' R U' R'", group: "Connected Pairs", slot: 'FR', alts: ["U' R U R2 F R F' R U' R'", "U F' L' U L F R U R'"] },
  { id: 'F2L-25', set: 'F2L', name: 'F2L 25', alg: "U' R' F R F' R U R'", group: "Corner In Slot", slot: 'FR', alts: ["R' F' R U R U' R' F", "U' F' U F U R U' R'", "l' U' l U l F' l' F"] },
  { id: 'F2L-26', set: 'F2L', name: 'F2L 26', alg: "U R U' R' F R' F' R", group: "Corner In Slot", slot: 'FR', alts: ["R S' R' U R S R'", "U R U' R' U' F' U F"] },
  { id: 'F2L-27', set: 'F2L', name: 'F2L 27', alg: "R U' R' U R U' R'", group: "Corner In Slot", slot: 'FR', alts: ["F' U' F U2 R U' R'"] },
  { id: 'F2L-28', set: 'F2L', name: 'F2L 28', alg: "R U R' U' F R' F' R", group: "Corner In Slot", slot: 'FR', alts: ["F' U F U' F' U F"] },
  { id: 'F2L-29', set: 'F2L', name: 'F2L 29', alg: "R' F R F' U R U' R'", group: "Corner In Slot", slot: 'FR', alts: ["R' F R F' R' F R F'"] },
  { id: 'F2L-30', set: 'F2L', name: 'F2L 30', alg: "R U R' U' R U R'", group: "Corner In Slot", slot: 'FR', alts: ["U' R U2 R' U2 R U R'", "U' F R' F' R2 U R'", "U2 F' U F R U R'"] },
  { id: 'F2L-31', set: 'F2L', name: 'F2L 31', alg: "U' R' F R F' R U' R'", group: "Edge In Slot", slot: 'FR', alts: ["F' U F R U2 R'"] },
  { id: 'F2L-32', set: 'F2L', name: 'F2L 32', alg: "U R U' R' U R U' R' U R U' R'", group: "Edge In Slot", slot: 'FR', alts: ["R U R' U' R U R' U' R U R'", "R2 U R2 U R2 U2 R2", "U' F R' F' R U' R U R'"] },
  { id: 'F2L-33', set: 'F2L', name: 'F2L 33', alg: "U' R U' R' U2 R U' R'", group: "Edge In Slot", slot: 'FR', alts: ["R U R' U' R U' R' U R U' R'", "U' R U' R' U' R U2 R'"] },
  { id: 'F2L-34', set: 'F2L', name: 'F2L 34', alg: "U R U R' U2 R U R'", group: "Edge In Slot", slot: 'FR', alts: ["U' R U2 R' U R U R'", "U R' D' R U' R' D R"] },
  { id: 'F2L-35', set: 'F2L', name: 'F2L 35', alg: "U' R U R' U F' U' F", group: "Edge In Slot", slot: 'FR', alts: ["U2 R U R' F R' F' R"] },
  { id: 'F2L-36', set: 'F2L', name: 'F2L 36', alg: "U F' U' F U' R U R'", group: "Edge In Slot", slot: 'FR', alts: ["U2 R' F R F' U2 R U R'", "R U R' U R U R' U' F' U' F", "R2 u R U R' U' u' R' U R'"] },
  { id: 'F2L-37', set: 'F2L', name: 'F2L 37', alg: "R2 U2 F R2 F' U2 R' U R'", group: "Pieces In Slot", slot: 'FR', alts: ["R U2 R' U R U2 R' U F' U' F"] },
  { id: 'F2L-38', set: 'F2L', name: 'F2L 38', alg: "R U' R' U' R U R' U2 R U' R'", group: "Pieces In Slot", slot: 'FR', alts: ["R U R' U' R U2 R' U' R U R'", "R2 U2 R' U' R U' R' U2 R'", "R U' R' U' R U R' U' R U2 R'"] },
  { id: 'F2L-39', set: 'F2L', name: 'F2L 39', alg: "R U' R' U R U2 R' U R U' R'", group: "Pieces In Slot", slot: 'FR', alts: ["R U2 R U R' U R U2 R2", "R U R' U2 R U' R' U R U R'", "R U2 R' U R U' R' U R U R'"] },
  { id: 'F2L-40', set: 'F2L', name: 'F2L 40', alg: "r U' r' U2 r U r' R U R'", group: "Pieces In Slot", slot: 'FR', alts: ["F' L' U2 L F R U R'", "R U' R' F R U R' U' F' R U' R'"] },
  { id: 'F2L-41', set: 'F2L', name: 'F2L 41', alg: "R U' R' r U' r' U2 r U r'", group: "Pieces In Slot", slot: 'FR', alts: ["R U' R' F' L' U2 L F"] },
];
