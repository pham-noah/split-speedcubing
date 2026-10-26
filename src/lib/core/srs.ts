// Spaced repetition using FSRS (Free Spaced Repetition Scheduler) via the open-source ts-fsrs library.
// FSRS models each case's memory with stability and difficulty and schedules the next review for a target retention
// (default 90%: you should still recall the case 9 times out of 10 when it comes due). It runs fully offline.
// The rest of the app only sees this small module, so the scheduler can be swapped again without touching the UI.
import { createEmptyCard, fsrs, generatorParameters, State, type Card as FCard, type FSRS, type Grade as FGrade } from 'ts-fsrs';

export type Grade = 0 | 1 | 2 | 3; // Again, Hard, Good, Easy
export const MIN = 60_000, DAY = 86_400_000;

export interface FsrsData {
  stability: number; difficulty: number; scheduled_days: number; learning_steps: number;
  reps: number; lapses: number; state: number; last_review?: number;
}
export interface Card {
  seen: boolean;
  due: number;          // ms since epoch
  fsrs?: FsrsData;
  box?: number;         // legacy (v0.1 Leitner boxes); migrated on the next review
}
export const newCard = (): Card => ({ seen: false, due: 0 });

export const DEFAULT_RETENTION = 0.9;
export const MASTERED_STABILITY_DAYS = 14;

// `w` are optional personalised FSRS parameters (see fsrs-optimize.ts); without them the library defaults are used.
const cache = new Map<string, FSRS>();
function scheduler(retention: number, w?: number[]): FSRS {
  const r = Math.min(0.99, Math.max(0.7, retention));
  const key = `${r}|${w?.join(',') ?? ''}`;
  let f = cache.get(key);
  if (!f) {
    f = fsrs(generatorParameters({ request_retention: r, enable_fuzz: false, ...(w && w.length === 21 ? { w } : {}) }));
    if (cache.size > 20) cache.clear();
    cache.set(key, f);
  }
  return f;
}

// Legacy box -> approximate FSRS memory, so nobody loses progress when upgrading.
const LEGACY_STABILITY_DAYS = [0, 0.5, 1, 3, 7, 21];
function toFsrsCard(c: Card, now: number): FCard {
  if (c.fsrs) {
    const f = c.fsrs;
    return {
      due: new Date(c.due), stability: f.stability, difficulty: f.difficulty,
      elapsed_days: f.last_review ? Math.max(0, Math.floor((now - f.last_review) / DAY)) : 0,
      scheduled_days: f.scheduled_days, learning_steps: f.learning_steps, reps: f.reps, lapses: f.lapses,
      state: f.state as State, last_review: f.last_review ? new Date(f.last_review) : undefined,
    };
  }
  if (c.seen && c.box && c.box > 0) {
    const s = LEGACY_STABILITY_DAYS[Math.min(c.box, 5)];
    return {
      due: new Date(c.due), stability: s, difficulty: 5, elapsed_days: 0, scheduled_days: Math.round(s),
      learning_steps: 0, reps: c.box, lapses: 0, state: State.Review, last_review: new Date(c.due - s * DAY),
    };
  }
  return createEmptyCard(new Date(now));
}
function fromFsrsCard(f: FCard): Card {
  return {
    seen: true, due: f.due.getTime(),
    fsrs: {
      stability: f.stability, difficulty: f.difficulty, scheduled_days: f.scheduled_days, learning_steps: f.learning_steps,
      reps: f.reps, lapses: f.lapses, state: f.state, last_review: f.last_review?.getTime(),
    },
  };
}

export function review(c: Card, g: Grade, now = Date.now(), retention = DEFAULT_RETENTION, w?: number[]): Card {
  const out = scheduler(retention, w).next(toFsrsCard(c, now), new Date(now), (g + 1) as FGrade);
  return fromFsrsCard(out.card);
}

/** Probability (0..1) that you still recall the case right now, or null if it has never been reviewed. */
export function recall(c: Card, now = Date.now(), retention = DEFAULT_RETENTION, w?: number[]): number | null {
  if (!c.seen) return null;
  const f = toFsrsCard(c, now);
  if (f.state === State.New) return null;
  return scheduler(retention, w).get_retrievability(f, new Date(now), false);
}

// Suggest a grade from the result so the user doesn't have to rate every attempt.
// A DNF, a recognition tap that never came (ok = false) or a very slow solve all grade as a lapse,
// so the schedule -- and the "Lapsed" drill -- has failures to learn from.
export function gradeForAttempt(totalMs: number, recogMs: number | null, targetMs: number, ok = true): Grade {
  if (!ok || !Number.isFinite(totalMs) || targetMs <= 0) return 0;
  const recog = recogMs ?? totalMs;
  if (totalMs <= targetMs * 0.75) return 3;                              // quick all round
  if (totalMs <= targetMs * 1.25 && recog <= targetMs) return 2;         // on target
  if (totalMs <= targetMs * 2 && recog <= targetMs * 1.5) return 1;      // slow, but it came back
  return 0;
}

export type Mastery = 'new' | 'learning' | 'mastered';
export function mastery(c: Card): Mastery {
  if (!c.seen) return 'new';
  const f = c.fsrs;
  if (f) return f.state === State.Review && f.stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'learning';
  return (c.box ?? 0) >= 3 ? 'mastered' : 'learning'; // legacy
}

export function dueLabel(c: Card, now = Date.now()): string {
  if (!c.seen) return '–';
  if (c.due <= now) return 'now';
  const m = (c.due - now) / MIN;
  if (m < 60) return `in ${Math.max(1, Math.round(m))} min`;
  if (m < 60 * 24) return `in ${Math.round(m / 60)} h`;
  return `in ${Math.round(m / 60 / 24)} d`;
}

// Choose the next case: most overdue first, then new ones, then the soonest due. Never the same case twice in a row.
export function pickNext<T extends { id: string }>(items: T[], cards: Record<string, Card>, last: string | null, now = Date.now(), rnd = Math.random): T | null {
  const pool = items.length > 1 ? items.filter(i => i.id !== last) : items;
  const card = (i: T) => cards[i.id] ?? newCard();
  const due = pool.filter(i => card(i).seen && card(i).due <= now).sort((a, b) => card(a).due - card(b).due);
  if (due.length) return due[0];
  const fresh = pool.filter(i => !card(i).seen);
  if (fresh.length) return fresh[Math.floor(rnd() * Math.min(fresh.length, 3))];
  return [...pool].sort((a, b) => card(a).due - card(b).due)[0] ?? null;
}
