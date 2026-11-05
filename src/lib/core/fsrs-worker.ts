// The optimiser off the UI thread. Replaying thousands of reviews is seconds of arithmetic: on the
// main thread the timer stutters and Android may show the app as unresponsive, so it runs here and
// posts a fraction of the work done as it goes.
import { optimizeParameters, type CardLog, type OptResult } from './fsrs-optimize';

export interface OptimizeRequest { logs: CardLog[] }
export type OptimizeReply = { type: 'progress'; f: number } | { type: 'done'; result: OptResult };

// `self` in a worker, `globalThis` in the type checker: one cast is cheaper than a webworker lib
const ctx = globalThis as unknown as {
  onmessage: ((e: MessageEvent<OptimizeRequest>) => void) | null;
  postMessage: (m: OptimizeReply) => void;
};

ctx.onmessage = async (e) => {
  try {
    const result = await optimizeParameters(e.data.logs, undefined, {
      onProgress: (f) => ctx.postMessage({ type: 'progress', f }),
    });
    ctx.postMessage({ type: 'done', result });
  } catch (err) {
    // the caller falls back to running it inline, which reports its own error
    ctx.postMessage({ type: 'done', result: { applied: false, w: [], before: 0, after: 0, n: 0, nVal: 0, reason: err instanceof Error ? err.message : 'The optimiser failed.' } });
  }
};
