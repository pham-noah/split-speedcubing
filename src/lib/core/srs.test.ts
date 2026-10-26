import { describe, it, expect } from 'vitest';
import { review, newCard, pickNext, gradeForAttempt, mastery, recall, dueLabel, DAY, MIN, type Card } from './srs';

const now = 1_800_000_000_000;
describe('FSRS scheduling', () => {
  it('a new card reviewed Good becomes a seen card due soon', () => {
    const c = review(newCard(), 2, now);
    expect(c.seen).toBe(true);
    expect(c.due).toBeGreaterThan(now);
    expect(c.fsrs!.reps).toBe(1);
  });
  it('better grades are scheduled further out', () => {
    const due = (g: 0 | 1 | 2 | 3) => review(newCard(), g, now).due;
    expect(due(0)).toBeLessThanOrEqual(due(1));
    expect(due(1)).toBeLessThanOrEqual(due(2));
    expect(due(2)).toBeLessThan(due(3));
  });
  it('intervals grow with repeated successful reviews and fall back after a lapse', () => {
    let c = review(newCard(), 3, now);
    let t = c.due;
    const gaps: number[] = [];
    for (let i = 0; i < 6; i++) { const next = review(c, 2, t); gaps.push(next.due - t); c = next; t = c.due; }
    expect(gaps[gaps.length - 1]).toBeGreaterThan(gaps[1]);
    const stab = c.fsrs!.stability;
    const lapsed = review(c, 0, t);
    expect(lapsed.fsrs!.stability).toBeLessThan(stab);
    expect(lapsed.fsrs!.lapses).toBe(1);
  });
  it('higher requested retention means shorter intervals', () => {
    let c = review(newCard(), 3, now);
    c = review(c, 2, c.due);
    const a = review(c, 2, c.due, 0.8).due - c.due, b = review(c, 2, c.due, 0.95).due - c.due;
    expect(a).toBeGreaterThan(b);
  });
  it('recall probability drops over time and is null for new cards', () => {
    expect(recall(newCard(), now)).toBeNull();
    let c = review(newCard(), 3, now);
    c = review(c, 2, c.due);
    const soon = recall(c, c.fsrs!.last_review! + 1 * DAY)!, late = recall(c, c.fsrs!.last_review! + 60 * DAY)!;
    expect(soon).toBeGreaterThan(late);
    expect(soon).toBeLessThanOrEqual(1);
    expect(late).toBeGreaterThan(0);
  });
  it('migrates a legacy box card without losing its progress', () => {
    const legacy: Card = { seen: true, box: 4, due: now - DAY };
    const c = review(legacy, 2, now);
    expect(c.fsrs).toBeDefined();
    expect(c.fsrs!.stability).toBeGreaterThan(7);
    expect(mastery(legacy)).toBe('mastered');
  });
  it('mastery follows stability', () => {
    expect(mastery(newCard())).toBe('new');
    expect(mastery(review(newCard(), 2, now))).toBe('learning');
    let c = review(newCard(), 3, now);
    for (let i = 0; i < 8; i++) c = review(c, 3, c.due);
    expect(mastery(c)).toBe('mastered');
  });
  it('due labels', () => {
    expect(dueLabel(newCard(), now)).toBe('–');
    expect(dueLabel({ seen: true, due: now - 1 }, now)).toBe('now');
    expect(dueLabel({ seen: true, due: now + 30 * MIN }, now)).toBe('in 30 min');
    expect(dueLabel({ seen: true, due: now + 3 * DAY }, now)).toBe('in 3 d');
  });
});

describe('grading an attempt from its result', () => {
  it('grades by how close the attempt was to the target', () => {
    expect(gradeForAttempt(1000, 300, 3000)).toBe(3);
    expect(gradeForAttempt(3000, 1000, 3000)).toBe(2);
    expect(gradeForAttempt(6000, 2000, 3000)).toBe(1);
    expect(gradeForAttempt(9000, 2000, 3000)).toBe(0);
  });
  it('a failed attempt or a very slow one is a lapse', () => {
    expect(gradeForAttempt(1000, 300, 3000, false)).toBe(0);
    expect(gradeForAttempt(7000, 4000, 3000)).toBe(0);
  });
  it('a slow recognition caps the grade at Hard', () => {
    expect(gradeForAttempt(4000, 4000, 3000)).toBe(1);
  });
  it('nonsense input grades as a lapse instead of NaN', () => {
    expect(gradeForAttempt(NaN, null, 3000)).toBe(0);
    expect(gradeForAttempt(1000, null, 0)).toBe(0);
  });
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('picks the most overdue due card first', () => {
    const cards = { a: { seen: true, due: now - 1000 }, b: { seen: true, due: now - 5000 } };
    expect(pickNext(items, cards, null, now)!.id).toBe('b');
  });
  it('then new cards, and never repeats the last one', () => {
    const cards = { a: { seen: true, due: now + DAY } };
    expect(['b', 'c']).toContain(pickNext(items, cards, null, now, () => 0)!.id);
    expect(pickNext(items, { a: { seen: true, due: now - 1 } }, 'a', now, () => 0)!.id).not.toBe('a');
  });
  it('falls back to the soonest due when nothing is due or new', () => {
    const cards = { a: { seen: true, due: now + 3 * DAY }, b: { seen: true, due: now + DAY }, c: { seen: true, due: now + 2 * DAY } };
    expect(pickNext(items, cards, null, now)!.id).toBe('b');
  });
});
