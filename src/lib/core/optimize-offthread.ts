// Ask for the optimiser to run off the UI thread, and run it here when the platform has no worker
// (an old Android webview, jsdom in the tests). Both paths call the same function, so the parameters
// do not depend on which one ran.
import { optimizeParameters, type CardLog, type OptResult } from './fsrs-optimize';
import type { OptimizeReply, OptimizeRequest } from './fsrs-worker';

export const inline = (logs: CardLog[], onProgress?: (f: number) => void): Promise<OptResult> =>
  optimizeParameters(logs, undefined, { onProgress, yieldToUi: true });

export function optimizeOffThread(logs: CardLog[], onProgress?: (f: number) => void): Promise<OptResult> {
  if (typeof Worker === 'undefined') return inline(logs, onProgress);
  let worker: Worker;
  try {
    worker = new Worker(new URL('./fsrs-worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return inline(logs, onProgress);
  }
  return new Promise<OptResult>((resolve) => {
    const fallBack = () => { worker.terminate(); inline(logs, onProgress).then(resolve); };
    worker.onmessage = (e: MessageEvent<OptimizeReply>) => {
      const m = e.data;
      if (m.type === 'progress') { onProgress?.(m.f); return; }
      worker.terminate();
      // an empty parameter set means the worker itself threw: same answer, but say so from here
      if (!m.result.w.length) { inline(logs, onProgress).then(resolve); return; }
      resolve(m.result);
    };
    worker.onerror = fallBack;
    const req: OptimizeRequest = { logs };
    worker.postMessage(req);
  });
}
