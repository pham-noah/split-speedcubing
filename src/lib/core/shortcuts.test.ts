import { describe, it, expect } from 'vitest';
import { COMMANDS, keyFor, conflictFor, canBind, codeLabel, matches } from './shortcuts';

describe('shortcuts', () => {
  it('defaults have no conflicts', () => {
    for (const c of COMMANDS) expect(conflictFor(c.id, c.def, {}), c.id).toBeNull();
  });
  it('overrides win over defaults', () => {
    expect(keyFor('plus2', {})).toBe('KeyZ');
    expect(keyFor('plus2', { plus2: 'KeyY' })).toBe('KeyY');
  });
  it('detects conflicts within overlapping scopes only', () => {
    expect(conflictFor('plus2', 'KeyD', {})?.id).toBe('history');    // same scope
    expect(conflictFor('plus2', 'Space', {})?.id).toBe('timer');     // global clashes with everything
    expect(conflictFor('nextCase', 'KeyZ', {})).toBeNull();          // train and solve do not overlap
    expect(conflictFor('dnf', 'KeyZ', { plus2: 'KeyQ' })).toBeNull(); // freed by a rebind
  });
  it('rejects modifier keys and Tab', () => {
    expect(canBind('ShiftLeft')).toBe(false);
    expect(canBind('Tab')).toBe(false);
    expect(canBind('KeyZ')).toBe(true);
  });
  it('labels', () => {
    expect(codeLabel('KeyP')).toBe('P');
    expect(codeLabel('Digit3')).toBe('3');
    expect(codeLabel('ArrowLeft')).toBe('Left arrow');
    expect(codeLabel('Space')).toBe('Space');
  });
  it('matches ignores presses with ctrl/alt/meta', () => {
    expect(matches({ code: 'KeyZ' }, 'plus2', {})).toBe(true);
    expect(matches({ code: 'KeyZ', ctrlKey: true }, 'plus2', {})).toBe(false);
  });
});

describe('rebinding onto a stock alias', () => {
  it('is refused, because the alias would fire both commands', () => {
    expect(conflictFor('dnf', 'KeyP', {})?.id).toBe('plus2');   // P is the +2 alias
  });
});
