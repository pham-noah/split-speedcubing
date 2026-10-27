// Builds a realistic demo data set (a few days of solves and PLL/OLL/F2L training progress) for screenshots.
// Run: npx vite-node scripts/seed-demo.ts > /tmp/seed.json
import { randomMoveScramble } from '../src/lib/core/scramble';
import { review, type Card, type Grade } from '../src/lib/core/srs';
import { defaultData, type CardRecord } from '../src/lib/storage/model';
import { PLL } from '../src/lib/data/pll';
import { OLL } from '../src/lib/data/oll';
import { F2L_FR } from '../src/lib/data/f2l-fr';

let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const now = Date.now(), DAY = 86_400_000;
const d = defaultData();
d.settings.introSeen = true;

// ~45 solves over three days, getting a little faster
d.solves = Array.from({ length: 46 }, (_, i) => {
  const base = 12.4 - i * 0.04 + (rnd() - 0.5) * 3.2;
  const pen = i === 17 ? 'DNF' : rnd() < 0.06 ? '+2' : '';
  return { id: `s${i}`, ms: Math.round(base * 1000), pen: pen as '' | '+2' | 'DNF', scramble: randomMoveScramble(20, rnd), event: '333', ts: now - (46 - i) * 55 * 60_000, session: 'default' };
});
d.sessions = [{ id: 'default', name: 'Session 1' }, { id: 'practice', name: 'One-handed' }];
d.solves.push(...Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, ms: Math.round((24 + rnd() * 6) * 1000), pen: '' as const, scramble: randomMoveScramble(20, rnd), event: '333', ts: now - (8 - i) * 3 * DAY / 8, session: 'practice' })));

function train(id: string, reviews: number, goodBias: number, dueIn: number | null) {
  let card: Card = { seen: false, due: 0 };
  const rec: CardRecord = { ...card, attempts: [] };
  let t = now - (reviews + 1) * 1.5 * DAY;
  for (let i = 0; i < reviews; i++) {
    t += (0.5 + rnd()) * DAY;
    const g = (rnd() < goodBias ? (rnd() < 0.3 ? 3 : 2) : rnd() < 0.5 ? 1 : 0) as Grade;
    card = review(card, g, t);
    rec.attempts.push({ ts: t, total: Math.round((2400 + rnd() * 2600) * (g === 0 ? 1.7 : 1)), recog: Math.round(600 + rnd() * 900), grade: g, alg: undefined });
  }
  if (reviews) Object.assign(rec, card);
  if (dueIn !== null) rec.due = now + dueIn;
  d.cards[id] = rec;
}
PLL.forEach((c, i) => train(c.id, [7, 6, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0][i], 0.85, i % 3 === 0 && i > 7 ? -DAY / 3 : null));
OLL.slice(0, 18).forEach((c, i) => train(c.id, [6, 5, 5, 4, 3, 3, 2, 2, 1, 1, 1][i] ?? 0, 0.8, null));
F2L_FR.slice(0, 12).forEach((c, i) => train(c.id, [5, 4, 4, 3, 3, 2, 2, 1, 1][i] ?? 0, 0.8, null));
console.log(JSON.stringify(d));
