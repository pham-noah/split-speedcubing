// One place for the WCAG maths: the accent colour, the full-screen cover and the contrast test
// all need to know how readable one colour is on another.

/** WCAG 2.x relative luminance of a #rrggbb colour: 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

/** WCAG contrast ratio between two colours: 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of `onLight` / `onDark` reads better on `hex` -- decided by contrast ratio, not by a
 *  brightness threshold (mid-tone colours like the delta green land on the wrong side of those).
 *  Anything that is not a #rrggbb colour falls through to `onDark`. */
export function readableInk(hex: string, onLight: string, onDark: string): string {
  if (!isHex(hex)) return onDark;
  return contrast(onLight, hex) >= contrast(onDark, hex) ? onLight : onDark;
}
