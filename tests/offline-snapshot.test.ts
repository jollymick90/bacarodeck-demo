import { describe, expect, it } from 'vitest';
import { collections } from '../src/lib/fields';
import { offlineAccess, validSnapshot, type OfflineSnapshot } from '../src/lib/offline/snapshot';
import { downloadSnapshot } from '../src/lib/offline/download';
const now = Date.UTC(2026, 9, 27);
const snapshot = (): OfflineSnapshot => ({
  version: 1,
  scope: 'test',
  identity: { uid: 'one', displayName: 'Member', email: 'member@test' },
  verifiedAt: now,
  downloadedAt: now,
  data: Object.fromEntries(collections.map((c) => [c, []])),
  members: []
});

describe('local authorization', () => {
  it('allows a complete snapshot only within 30 days for the same scope and identity', () => {
    const s = snapshot();
    expect(validSnapshot(s)).toBe(true);
    expect(offlineAccess(s, 'test', null, now + 30 * 86400000 - 1)).toBe(true);
    expect(offlineAccess(s, 'test', null, now + 30 * 86400000)).toBe(false);
    expect(offlineAccess(s, 'other', null, now)).toBe(false);
    expect(offlineAccess(s, 'test', 'other', now)).toBe(false);
    expect(offlineAccess(s, 'test', 'one', now - 1)).toBe(false);
  });
  it('rejects partial and corrupt packages', () => {
    const s = snapshot();
    delete s.data.materials;
    expect(validSnapshot(s)).toBe(false);
    expect(validSnapshot({ ...snapshot(), verifiedAt: 'yesterday' })).toBe(false);
  });
});

it('downloads every page and rejects changes without committing partial content', async () => {
  let changed = false;
  const manifest = () => ({
    versions: Object.fromEntries(
      [...collections, 'members'].map((c) => [c, c === 'speakers' && changed ? 'new' : 'v1'])
    )
  });
  const request = async (query: string) => {
    const p = new URLSearchParams(query);
    if (!p.has('collection')) return manifest();
    if (p.get('collection') === 'speakers') {
      changed = true;
      return { version: 'v1', entities: [{ id: 's' }], next: null };
    }
    return { version: 'v1', entities: [], next: null };
  };
  await expect(
    downloadSnapshot(request, snapshot(), () => {}, new AbortController().signal)
  ).rejects.toThrow(/cambiat/i);
});

it('follows paginated cursors and returns only a complete package', async () => {
  const manifest = {
    versions: Object.fromEntries([...collections, 'members'].map((c) => [c, 'v1']))
  };
  const seen: string[] = [];
  const request = async (query: string) => {
    const p = new URLSearchParams(query);
    if (!p.has('collection')) return manifest;
    seen.push(p.get('collection')!);
    const second = p.get('offset') === '1';
    return {
      version: 'v1',
      entities:
        p.get('collection') === 'materials'
          ? [{ id: second ? 'm2' : 'm1', bodyMd: 'Never opened' }]
          : [],
      next: p.get('collection') === 'materials' && !second ? 1 : null
    };
  };
  const result = await downloadSnapshot(
    request,
    snapshot(),
    () => {},
    new AbortController().signal
  );
  expect(result.data.materials?.map((m) => m.id)).toEqual(['m1', 'm2']);
  expect(new Set(seen).size).toBe(collections.length + 1);
});
