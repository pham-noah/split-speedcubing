import type { Solve } from '../core/stats';
import type { Card } from '../core/srs';

export interface Attempt { ts: number; total: number; recog: number | null; grade: number; alg?: string; pen?: '+2' | 'DNF' }
// algs = extra algorithms the user added (the built-in one is always available); defaultAlg = the one used for training.
// `alg` is the legacy single-alg field from v0.1, migrated in normalize().
export interface CardRecord extends Card { algs?: string[]; defaultAlg?: string; alg?: string; attempts: Attempt[] }
export interface Settings { theme: 'midnight' | 'amoled' | 'contrast'; textSize: number; holdMs: number; inspection: boolean; beeps: boolean; hideTime: boolean; tapStart: boolean; retention: number; keys: Record<string, string>; hidden: Record<string, boolean>; introSeen: boolean; coverOn: boolean; coverColor: string; accent: string; walkAutoplay: boolean; walkSpeed: number; cubeColors: string[]; swapRO: boolean; drillTwoLook?: boolean; lastBackupAt?: number; fsrsW?: number[] }
export interface DrillResult { type: 'cross' | 'bld' | 'oll2' | 'pll2'; ms: number; memo: number | null; ok: boolean; ts: number; info?: string; pen?: '+2' | 'DNF' }
export interface Session { id: string; name: string }
export interface CustomCase { id: string; name: string; alg: string }
export interface AppData { v: 1; solves: Solve[]; cards: Record<string, CardRecord>; settings: Settings; drills: DrillResult[]; sessions: Session[]; session: string; zbll: CustomCase[] }

export const defaultSettings = (): Settings => ({ theme: 'midnight', textSize: 100, holdMs: 300, tapStart: false, inspection: false, beeps: true, hideTime: false, retention: 0.9, keys: {}, hidden: {}, introSeen: false, coverOn: true, coverColor: '', accent: '', walkAutoplay: false, walkSpeed: 900, cubeColors: [], swapRO: false });
export const defaultData = (): AppData => ({ v: 1, solves: [], cards: {}, settings: defaultSettings(), drills: [], sessions: [{ id: 'default', name: 'Session 1' }], session: 'default', zbll: [] });

// Accepts anything parsed from a backup file and returns safe, complete data (throws if it is not a backup).
export function normalize(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Split backup');
  const r = raw as Partial<AppData>;
  if (!Array.isArray(r.solves) && typeof r.cards !== 'object') throw new Error('Not a Split backup');
  const out: AppData = {
    v: 1,
    solves: (Array.isArray(r.solves) ? r.solves : []).filter(s => s && typeof s.ms === 'number'),
    cards: migrateCards(r.cards && typeof r.cards === 'object' ? (r.cards as Record<string, CardRecord>) : {}),
    settings: { ...defaultSettings(), ...(r.settings ?? {}) },
    sessions: Array.isArray(r.sessions) && r.sessions.length ? r.sessions.filter(x => x && x.id) : [{ id: 'default', name: 'Session 1' }],
    session: typeof r.session === 'string' ? r.session : 'default',
    zbll: Array.isArray(r.zbll) ? r.zbll.filter(c => c && c.id && c.alg) : [],
    drills: Array.isArray(r.drills) ? r.drills.filter(d => d && typeof d.ms === 'number') : [],
  };
  if (out.settings.fsrsW && !(out.settings.fsrsW.length === 21 && out.settings.fsrsW.every(Number.isFinite))) delete out.settings.fsrsW;
  // solves from before sessions existed belong to the first session
  const first = out.sessions[0].id;
  for (const s of out.solves) s.session ??= first;
  if (!out.sessions.some(x => x.id === out.session)) out.session = first;
  return out;
}

function migrateCards(cards: Record<string, CardRecord>): Record<string, CardRecord> {
  for (const c of Object.values(cards)) {
    if (c.alg) {
      c.algs = [...new Set([...(c.algs ?? []), c.alg])];
      c.defaultAlg ??= c.alg;
      delete c.alg;
    }
    c.attempts ??= [];
  }
  return cards;
}
