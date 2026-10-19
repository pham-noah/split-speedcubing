import { describe, it, expect } from 'vitest';
import { makeHints, slug } from './hints';

describe('case hints', () => {
  it('uses the case name, not a generated code', () => {
    expect(slug('Jb-perm')).toBe('jb');
    expect(slug('Aa-perm')).toBe('aa');
    expect(slug('OLL 27')).toBe('27');
    expect(slug('F2L 4')).toBe('4');
    expect(slug('Sune + T 1')).toBe('sunet1');
  });
  it('keeps single-letter and numeric names short', () => {
    const m = makeHints([{ id: 'a', name: 'E-perm' }, { id: 'b', name: 'T-perm' }, { id: 'c', name: 'OLL 7' }]);
    expect([...m.values()]).toEqual(['e', 't', '7']);
  });
  it('grows a collision by one character instead of colliding', () => {
    const m = makeHints([{ id: 'a', name: 'OLL 1' }, { id: 'b', name: '1' }, { id: 'c', name: '1' }]);
    expect(m.get('a')).toBe('1');
    expect(m.get('b')).toBe('1a');
    expect(m.get('c')).toBe('1s'); // second collision: next character of the home row
    expect(new Set(m.values()).size).toBe(3);
  });
  it('pads an all-numeric set so no code is a prefix of another', () => {
    const m = makeHints([{ id: 'a', name: 'OLL 2' }, { id: 'b', name: 'OLL 29' }, { id: 'c', name: 'OLL 57' }]);
    expect([...m.values()]).toEqual(['02', '29', '57']);
  });
  it('falls back to the position when the name has nothing typeable', () => {
    const m = makeHints([{ id: 'x', name: '◆' }, { id: 'y', name: '◆◆' }]);
    expect(m.get('x')).toBe('1');
    expect(m.get('y')).toBe('2');
  });
});
