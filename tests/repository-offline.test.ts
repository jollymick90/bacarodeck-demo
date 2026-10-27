import { afterEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ user: null as any }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: auth.user }) }));
import { api, setWriteAccess } from '../src/lib/repository';
afterEach(() => {
  setWriteAccess(false);
  vi.unstubAllGlobals();
});
it('does not send a mutation if access locks while waiting for a token', async () => {
  vi.stubGlobal('navigator', { onLine: true });
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  let token: (value: string) => void = () => {};
  auth.user = {
    getIdToken: () =>
      new Promise((r) => {
        token = r;
      })
  };
  setWriteAccess(true);
  const result = api('/api/backup', { action: 'restore' });
  setWriteAccess(false);
  token('token');
  await expect(result).rejects.toThrow(/sola lettura/);
  expect(fetch).not.toHaveBeenCalled();
});
it('does not queue offline mutations even with a restored Firebase user', async () => {
  vi.stubGlobal('navigator', { onLine: false });
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  setWriteAccess(true);
  await expect(api('/api/data', { action: 'save' })).rejects.toThrow(/sola lettura/);
  expect(fetch).not.toHaveBeenCalled();
});
