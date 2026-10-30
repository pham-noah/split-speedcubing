import type { Platform } from './types';

/** Anchor download: the browser takes the file. */
export function saveFileViaAnchor(name: string, text: string, mime = 'application/json'): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  // revoking in the same tick cancels the download in Safari and Firefox
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Promise.resolve();
}

/** Hidden <input type="file">: the webview's own picker. */
export function pickFileViaInput(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise(resolve => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** Lets the stylesheet branch on the shell: html[data-platform="android"] .pc-only { display: none }. */
export function markShell(kind: Platform['kind']): void {
  document.documentElement.dataset.platform = kind;
}
