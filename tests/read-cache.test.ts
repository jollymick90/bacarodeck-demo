import { expect, it, vi } from 'vitest';
import { ReadCache, type CacheStore } from '../src/lib/server/read-cache';

function store(): CacheStore {
  const values = new Map<string, unknown>();
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    }
  };
}

it('shares reads between instances and expires without extending lifetime on hits', async () => {
  let now = 0;
  const backend = store();
  const a = new ReadCache(backend, () => now);
  const b = new ReadCache(backend, () => now);
  const load = vi.fn(async () => ['speaker']);
  await a.read('speakers', 300, load);
  now = 299_000;
  expect(await b.read('speakers', 300, load)).toEqual(['speaker']);
  expect(load).toHaveBeenCalledTimes(1);
  now = 300_000;
  await b.read('speakers', 300, load);
  expect(load).toHaveBeenCalledTimes(2);
});

it('coalesces concurrent reads and does not cache failures', async () => {
  const cache = new ReadCache(store());
  const load = vi.fn(async () => 42);
  expect(await Promise.all(Array.from({ length: 10 }, () => cache.read('x', 60, load)))).toEqual(
    Array(10).fill(42)
  );
  expect(load).toHaveBeenCalledTimes(1);
  const failure = vi.fn(async () => {
    throw new Error('offline');
  });
  await expect(cache.read('bad', 60, failure)).rejects.toThrow('offline');
  await expect(cache.read('bad', 60, failure)).rejects.toThrow('offline');
  expect(failure).toHaveBeenCalledTimes(2);
});

it('invalidates across instances even when an old read finishes after the write', async () => {
  const backend = store();
  const a = new ReadCache(backend);
  const b = new ReadCache(backend);
  let finish!: (value: string) => void;
  let started!: () => void;
  const loading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const old = a.read('questions', 300, () => {
    started();
    return new Promise<string>((resolve) => {
      finish = resolve;
    });
  });
  await loading;
  await b.invalidate('questions');
  expect(await b.read('questions', 300, async () => 'new')).toBe('new');
  finish('old');
  await old;
  expect(await a.read('questions', 300, async () => 'unexpected')).toBe('new');
});

it('keeps collections separate and supports cached empty results', async () => {
  const cache = new ReadCache(store());
  await cache.read('speakers', 60, async () => []);
  await cache.read('questions', 60, async () => [1]);
  await cache.invalidate('questions');
  const load = vi.fn(async () => [2]);
  expect(await cache.read('speakers', 60, load)).toEqual([]);
  expect(load).not.toHaveBeenCalled();
});

it('splits large collection snapshots below the Runtime Cache entry limit', async () => {
  const backend = store();
  const set = vi.spyOn(backend, 'set');
  const a = new ReadCache(backend);
  const b = new ReadCache(backend);
  const value = [{ abstractMd: 'Testo 🚀 '.repeat(350_000) }];
  await a.read('materials', 300, async () => value);
  const load = vi.fn(async () => []);
  expect(await b.read('materials', 300, load)).toEqual(value);
  expect(load).not.toHaveBeenCalled();
  for (const [, stored] of set.mock.calls) {
    expect(Buffer.byteLength(JSON.stringify(stored))).toBeLessThan(2 * 1024 * 1024);
  }
});

it('does not resurrect pre-invalidation data when the generation marker is evicted', async () => {
  const values = new Map<string, unknown>();
  const backend: CacheStore = {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    }
  };
  const cache = new ReadCache(backend);
  await cache.read('access-members', 15, async () => 'allowed');
  await cache.invalidate('access-members');
  values.delete('version:access-members');
  expect(await cache.read('access-members', 15, async () => 'blocked')).toBe('blocked');
});
