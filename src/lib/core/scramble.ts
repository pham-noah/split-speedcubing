// Random-state WCA scrambles come from cubing.js (loaded on demand, runs in a worker).
// If it fails to load (very old webview, offline first run) we fall back to random moves so the timer never blocks.
export function randomMoveScramble(len = 20, rnd = Math.random, F = 'RLUDFB'): string {
  // R/L is one axis, U/D another, F/B the third — read off the full face set, so a 2x2's RUF still
  // refuses two turns on the same axis in a row
  const axis = (c: string) => 'RLUDFB'.indexOf(c) >> 1;
  const out: string[] = [];
  let last = '', last2 = '';
  while (out.length < len) {
    const f = F[Math.floor(rnd() * F.length)];
    if (f === last || (f === last2 && axis(last) === axis(f))) continue;
    out.push(f + ['', "'", '2'][Math.floor(rnd() * 3)]);
    last2 = last; last = f;
  }
  return out.join(' ');
}

const TIMEOUT_MS = 8000;
export async function newScramble(event = '333'): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // never wait forever: if the worker is blocked or fails to start, fall back to random moves
    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error('scramble timeout')), TIMEOUT_MS); });
    const make = import('cubing/scramble').then(m => m.randomScrambleForEvent(event)).then(a => a.toString());
    return await Promise.race([make, timeout]);
  } catch {
    // a 2x2 has only R, U and F turns, and a WCA 2x2 scramble is 11 moves
    return event === '222' ? randomMoveScramble(11, Math.random, 'RUF') : randomMoveScramble();
  } finally {
    clearTimeout(timer);   // otherwise every scramble leaves a timer behind
  }
}

// Keeps one scramble ready so the next solve never waits.
export class ScrambleQueue {
  private next: Promise<string>;
  constructor(private event = '333') { this.next = newScramble(event); }
  async take(): Promise<string> {
    const s = await this.next;
    this.next = newScramble(this.event);
    return s;
  }
}
