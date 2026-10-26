import { describe, it, expect } from 'vitest';
import { luminance, readableInk, isHex } from './color';

describe('colour luminance', () => {
  it('runs from black to white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 3);
    expect(luminance('#808080')).toBeGreaterThan(0.2);
    expect(luminance('#808080')).toBeLessThan(0.3);
  });
  it('picks ink that stays readable', () => {
    expect(readableInk('#F5B83D', '#12161C', '#FFFFFF')).toBe('#12161C');   // amber is light
    expect(readableInk('#0F1115', '#12161C', '#FFFFFF')).toBe('#FFFFFF');   // midnight is dark
    expect(readableInk('#59D98A', '#12161C', '#FFFFFF')).toBe('#12161C');   // green is light
  });
  it('falls back to the dark-background ink for nonsense', () => {
    expect(readableInk('red', '#12161C', '#FFFFFF')).toBe('#FFFFFF');
    expect(readableInk('', '#12161C', '#FFFFFF')).toBe('#FFFFFF');
    expect(isHex('#12ab34')).toBe(true);
    expect(isHex('#12ab3')).toBe(false);
  });
});
