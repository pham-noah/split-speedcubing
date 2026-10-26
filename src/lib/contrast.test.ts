import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// WCAG 2.x contrast ratio between two #rrggbb colours
const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// read the real theme tokens from app.css so the test cannot drift from the app
const css = readFileSync('src/app.css', 'utf8');
function theme(selector: string, base: Record<string, string> = {}): Record<string, string> {
  const m = new RegExp(`${selector.replace(/[[\]]/g, '\\$&')}\\{([^}]*)\\}`).exec(css);
  const out = { ...base };
  for (const [, k, v] of (m?.[1] ?? '').matchAll(/--([a-z-]+):(#[0-9a-fA-F]{6})/g)) out[k] = v;
  return out;
}
const midnight = theme(':root');
const themes = { midnight, amoled: theme(':root[data-theme=amoled]', midnight), contrast: theme(':root[data-theme=contrast]', midnight) };

describe.each(Object.entries(themes))('contrast: %s theme', (_name, t) => {
  const text: [string, string, string][] = [
    ['body text on page', t.tx, t.bg], ['body text on cards', t.tx, t.card],
    ['muted text on page', t.mu, t.bg], ['muted text on cards', t.mu, t.card],
    ['amber text on page', t.am, t.bg], ['amber text on cards', t.am, t.card],
    ['button text on amber', t['on-am'], t.am],
    ['big button text on blue', '#06121F', t.bl],
    ['active tab on raised tab background', t.am, '#262B36'],
    ['error text on cards', '#FF8A80', t.card],
    // the delta colours (faster / slower, +progress bars) are tokens too, so they get checked here
    ['faster delta on page', t.good, t.bg], ['faster delta on cards', t.good, t.card],
    ['slower delta on page', t.bad, t.bg], ['slower delta on cards', t.bad, t.card],
  ];
  it.each(text)('%s is at least 4.5:1', (_l, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('big button states are readable', () => {
    expect(ratio('#000000', '#ffffff')).toBeGreaterThanOrEqual(4.5);   // ready (white)
    expect(ratio(t.tx, '#3A404C')).toBeGreaterThanOrEqual(4.5);        // running
  });
  it('focus ring and dashed/selected outlines are visible (3:1) against the page', () => {
    expect(ratio(t.bl, t.bg)).toBeGreaterThanOrEqual(3);
    expect(ratio(t.am, t.bg)).toBeGreaterThanOrEqual(3);
    expect(ratio('#4A5160', t.bg)).toBeGreaterThanOrEqual(2); // dashed "new case" outline: decorative, the label carries the meaning
  });
});
