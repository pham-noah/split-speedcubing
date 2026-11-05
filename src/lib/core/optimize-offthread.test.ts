import { describe, it, expect, afterEach } from 'vitest';
import { optimizeOffThread } from './optimize-offthread';
import type { OptimizeReply, OptimizeRequest } from './fsrs-worker';

// The optimiser is seconds of arithmetic, so it belongs in a worker; these tests are about the
// routing, not the maths (fsrs-optimize.test.ts covers that): which path runs, and that a worker that
// dies still produces an answer.

class FakeWorker {
  static last: FakeWorker | null = null;
  static reply: (req: OptimizeRequest, post: (m: OptimizeReply) => void) => void;
  onmessage: ((e: { data: OptimizeReply }) => void) | null = null;
  onerror: ((e: { message: string }) => void) | null = null;
  terminated = false;
  constructor(public url: URL, public opts: unknown) { FakeWorker.last = this; }
  postMessage(req: OptimizeRequest) {
    const post = (m: OptimizeReply) => this.onmessage?.({ data: m });
    queueMicrotask(() => FakeWorker.reply(req, post));
  }
  terminate() { this.terminated = true; }
}

const realWorker = (globalThis as { Worker?: unknown }).Worker;
const useFakeWorker = () => { (globalThis as { Worker?: unknown }).Worker = FakeWorker as unknown; };
afterEach(() => {
  (globalThis as { Worker?: unknown }).Worker = realWorker;
  FakeWorker.last = null;
});

describe('optimiser routing', () => {
  it('uses a worker when there is one, reports its progress, and terminates it', async () => {
    useFakeWorker();
    FakeWorker.reply = (_req, post) => {
      post({ type: 'progress', f: 0.25 });
      post({ type: 'progress', f: 1 });
      post({ type: 'done', result: { applied: true, w: [0.1], before: 0.9, after: 0.5, n: 120, nVal: 30, reason: 'better' } });
    };
    const seen: number[] = [];
    const r = await optimizeOffThread([], (f) => seen.push(f));

    expect(FakeWorker.last?.url.pathname).toMatch(/fsrs-worker\.ts$/);
    expect(FakeWorker.last?.terminated).toBe(true);
    expect(seen).toEqual([0.25, 1]);
    expect(r.applied).toBe(true);
    expect(r.w).toEqual([0.1]);
  });

  // jsdom has no Worker: the same call has to work, because that is how the tests and an old webview
  // reach it. A history too short to learn from is decided before any searching, so this stays quick.
  it('runs inline when the platform has no worker, with the same verdict', async () => {
    expect((globalThis as { Worker?: unknown }).Worker).toBeUndefined();
    const logs = [{ ts: 1, grade: 2 as const }, { ts: 2, grade: 2 as const }].map(l => [l]);
    const r = await optimizeOffThread(logs);
    expect(r.applied).toBe(false);
    expect(r.reason).toMatch(/Not enough history/);
  });

  it('falls back to running here when the worker itself fails', async () => {
    useFakeWorker();
    FakeWorker.reply = (_req, post) => {
      post({ type: 'done', result: { applied: false, w: [], before: 0, after: 0, n: 0, nVal: 0, reason: 'boom' } });
    };
    const logs = [[{ ts: 1, grade: 2 as const }, { ts: 2, grade: 3 as const }]];
    const r = await optimizeOffThread(logs);
    // not the worker's empty answer: the inline run replaced it with its own verdict and defaults
    expect(r.w.length).toBe(21);
    expect(r.reason).toMatch(/Not enough history/);
  });
});
