import { randomUUID } from 'node:crypto';

export interface CacheStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, options: { ttl: number }): Promise<unknown>;
}

type Entry<T> = { expiresAt: number; value: T };
type ChunkedEntry = { expiresAt: number; chunks: string[] };

/** Cache data, never HTTP responses or authorization decisions. */
export class ReadCache {
  private generations = new Map<string, Promise<string>>();
  private pending = new Map<string, Promise<unknown>>();
  constructor(
    private store: CacheStore,
    private now = Date.now
  ) {}

  async read<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const generation = await this.generation(key);
    const dataKey = `data:${key}:${generation}`;
    const running = this.pending.get(dataKey);
    if (running) return running as Promise<T>;
    const task = this.load(dataKey, ttl, load);
    this.pending.set(dataKey, task);
    try {
      return await task;
    } finally {
      this.pending.delete(dataKey);
    }
  }

  private async generation(key: string): Promise<string> {
    const running = this.generations.get(key);
    if (running) return running;
    const task = (async () => {
      const existing = await this.store.get(`version:${key}`);
      if (typeof existing === 'string') return existing;
      const version = randomUUID();
      await this.store.set(`version:${key}`, version, { ttl: 86400 });
      return version;
    })();
    this.generations.set(key, task);
    try {
      return await task;
    } finally {
      this.generations.delete(key);
    }
  }

  private async load<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const cached = (await this.store.get(key)) as Entry<T> | ChunkedEntry | null;
    if (cached && cached.expiresAt > this.now()) {
      if ('value' in cached) return cached.value;
      const parts = await Promise.all(cached.chunks.map((part) => this.store.get(part)));
      if (parts.every((part) => typeof part === 'string')) return JSON.parse(parts.join('')) as T;
    }
    // Start expiry before the query: a slow read cannot extend a stale permission window.
    const expiresAt = this.now() + ttl * 1000;
    const value = await load();
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) <= 1024 * 1024) {
      await this.store.set(key, { expiresAt, value }, { ttl });
    } else {
      // Each piece stays below Vercel's 2 MB limit even with JSON escaping/Unicode.
      const prefix = `${key}:chunks:${randomUUID()}`;
      const chunks: string[] = [];
      for (let start = 0; start < serialized.length; start += 128 * 1024) {
        const partKey = `${prefix}:${chunks.length}`;
        chunks.push(partKey);
        await this.store.set(partKey, serialized.slice(start, start + 128 * 1024), { ttl });
      }
      await this.store.set(key, { expiresAt, chunks }, { ttl });
    }
    return value;
  }

  async invalidate(key: string): Promise<void> {
    // New readers use a different key, even if a pre-write query completes later.
    // Keep the generation longer than any cached data (maximum TTL here: one hour).
    await this.store.set(`version:${key}`, randomUUID(), { ttl: 86400 });
  }
}
