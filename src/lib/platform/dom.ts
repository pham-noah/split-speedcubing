import type { Platform } from './types';

export function saveFileViaAnchor(name: string, text: string, mime = 'application/json'): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  // revoking in the same tick cancels the download in Safari and Firefox
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Promise.resolve();
}

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

export function markShell(kind: Platform['kind']): void {
  document.documentElement.dataset.platform = kind;
}
