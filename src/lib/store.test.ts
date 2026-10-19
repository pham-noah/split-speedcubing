import { describe, it, expect } from 'vitest';
import { normalize, defaultData } from './storage/model';

describe('sessions in the data model', () => {
  it('old backups get a default session and their solves are assigned to it', () => {
    const d = normalize({ solves: [{ id: 'a', ms: 1000, pen: '', scramble: '', event: '333', ts: 0 }], cards: {} });
    expect(d.sessions.length).toBe(1);
    expect(d.session).toBe(d.sessions[0].id);
    expect(d.solves[0].session).toBe(d.sessions[0].id);
    expect(d.zbll).toEqual([]);
  });
  it('an unknown current session falls back to the first', () => {
    const d = normalize({ solves: [], cards: {}, sessions: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }], session: 'gone' });
    expect(d.session).toBe('s1');
  });
  it('default data starts with one session', () => {
    expect(defaultData().sessions.length).toBe(1);
  });
});
