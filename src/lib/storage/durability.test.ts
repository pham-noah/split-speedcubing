import { describe, it, expect, afterEach, vi } from 'vitest';
import { durability, formatBytes } from './durability';

const withStorage = (s: unknown) => vi.stubGlobal('navigator', { storage: s });
const noStorage = () => vi.stubGlobal('navigator', {});

afterEach(() => vi.unstubAllGlobals());

describe('durability', () => {
  it('asks for persistence when the shell has not granted it yet', async () => {
    const persist = vi.fn(async () => true);
    withStorage({ persisted: async () => false, persist });
    expect(await durability()).toMatchObject({ persisted: true });
    expect(persist).toHaveBeenCalledOnce();
  });

  it('does not ask again once the answer is yes', async () => {
    const persist = vi.fn(async () => true);
    withStorage({ persisted: async () => true, persist });
    expect(await durability()).toMatchObject({ persisted: true });
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports usage and quota when the shell offers an estimate', async () => {
    withStorage({
      persisted: async () => true,
      estimate: async () => ({ usage: 1536 * 1024, quota: 120 * 1024 * 1024 }),
    });
    expect(await durability()).toEqual({ persisted: true, usage: 1536 * 1024, quota: 120 * 1024 * 1024 });
  });

  it('survives a shell that throws, and one with no storage API at all', async () => {
    withStorage({
      persisted: async () => {
        throw new Error('nope');
      },
      estimate: async () => {
        throw new Error('nope');
      },
    });
    expect(await durability()).toEqual({ persisted: null, usage: null, quota: null });
    noStorage();
    expect(await durability()).toEqual({ persisted: null, usage: null, quota: null });
  });
});

describe('formatBytes', () => {
  it('keeps the units readable', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('2 KB');
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB');
    expect(formatBytes(null)).toBe('');
  });
});
