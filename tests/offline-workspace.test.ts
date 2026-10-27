import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { collections } from '../src/lib/fields';
const mocks = vi.hoisted(() => ({
  listener: null as ((u: any) => void) | null,
  stored: null as any,
  fetch: vi.fn(),
  stop: vi.fn(),
  watch: vi.fn(),
  write: vi.fn(),
  clear: vi.fn(),
  download: vi.fn()
}));
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_FIREBASE_PROJECT_ID: 'test' } }));
vi.mock('../src/lib/firebase', () => ({
  workspaceId: 'workspace',
  getFirebase: () => ({ auth: {}, db: {} })
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_: unknown, fn: any) => {
    mocks.listener = fn;
    return () => {};
  },
  signInWithPopup: vi.fn(),
  signOut: async () => {
    mocks.listener?.(null);
  }
}));
vi.mock('../src/lib/offline/storage', () => ({
  OfflineStore: class {
    load = async () => mocks.stored;
    clear = async () => {
      await mocks.clear();
      mocks.stored = null;
    };
    renew = vi.fn(async () => {});
  }
}));
vi.mock('../src/lib/repository', () => ({
  ApiError: class extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
    }
  },
  api: vi.fn(),
  setWriteAccess: mocks.write,
  watchCollection: (...args: any[]) => {
    mocks.watch(...args);
    args[2]([], false);
    return mocks.stop;
  }
}));
vi.mock('../src/lib/offline/shell', () => ({ prepareOfflineShell: async () => {} }));
vi.mock('../src/lib/offline/download', () => ({ downloadSnapshot: mocks.download }));
import { ApiError } from '../src/lib/repository';
import { Workspace } from '../src/lib/workspace.svelte';
const user = {
  uid: 'one',
  displayName: 'One',
  email: 'one@test',
  getIdToken: async () => 'token'
} as any;
let dispose: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('location', { origin: 'http://local' });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.stored = {
    version: 1,
    scope: 'test:workspace:false:http://local',
    identity: { uid: 'one', displayName: 'One', email: 'one@test' },
    verifiedAt: Date.now(),
    downloadedAt: Date.now(),
    data: Object.fromEntries(
      collections.map((c) => [c, c === 'speakers' ? [{ id: 'speaker' }] : []])
    ),
    members: []
  };
});
afterEach(() => {
  dispose?.();
  vi.unstubAllGlobals();
});
it('logout deletes the copy and never restores the original startup promise', async () => {
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(user);
  await vi.waitFor(() => expect(w.access).toBe('local'));
  await w.logout();
  await new Promise((r) => setTimeout(r, 5));
  expect(w.access).toBe('login');
  expect(w.data.speakers).toBeUndefined();
  expect(w.offlineSnapshot).toBeNull();
});
it('a failed collection poll keeps complete in-memory data readable and disables writes', async () => {
  (navigator as any).onLine = true;
  mocks.stored = null;
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ superadmin: false }) });
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(user);
  await vi.waitFor(() => expect(w.ready).toBe(true));
  w.data.speakers = [{ id: 'keep' }];
  const failure = mocks.watch.mock.calls[0][3];
  failure(new Error('Network failure'));
  await vi.waitFor(() => expect(w.readOnly).toBe(true));
  expect(w.ready).toBe(true);
  expect(w.data.speakers).toEqual([{ id: 'keep' }]);
});
it('blocks cached content while checking reconnection and clears it on revocation', async () => {
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(user);
  await vi.waitFor(() => expect(w.ready).toBe(true));
  let respond: (r: unknown) => void = () => {};
  mocks.fetch.mockReturnValue(
    new Promise((r) => {
      respond = r;
    })
  );
  (navigator as any).onLine = true;
  window.dispatchEvent(new Event('online'));
  expect(w.checkingAccess).toBe(true);
  expect(w.ready).toBe(true);
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
  respond({ ok: false, status: 403, json: async () => ({ message: 'Revoked' }) });
  await vi.waitFor(() => expect(w.access).toBe('denied'));
  expect(w.data).toEqual({});
  expect(mocks.stored).toBeNull();
});

it('another tab logout cannot reopen an in-memory snapshot after IndexedDB was cleared', async () => {
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(user);
  await vi.waitFor(() => expect(w.access).toBe('local'));
  mocks.stored = null;
  mocks.listener!(null);
  await vi.waitFor(() => expect(w.access).not.toBe('loading'));
  expect(w.access).toBe('login');
  expect(w.offlineSnapshot).toBeNull();
});

it('a 401 after the local lease expires cannot keep the snapshot alive as a member', async () => {
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(user);
  await vi.waitFor(() => expect(w.access).toBe('local'));
  w.offlineSnapshot!.verifiedAt = Date.now() - 31 * 86400000;
  mocks.fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Expired' })
  });
  (navigator as any).onLine = true;
  window.dispatchEvent(new Event('online'));
  await vi.waitFor(() => expect(w.checkingAccess).toBe(false));
  expect(w.canRead).toBe(false);
});

it('a valid device copy is readable when Firebase has no restored user', async () => {
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(null);
  await vi.waitFor(() => expect(w.access).toBe('local'));
  expect(w.user).toBeNull();
  expect(w.identityUid).toBe('one');
  expect(w.readOnly).toBe(true);
});

it('a revocation during package update immediately locks and removes the previous copy', async () => {
  (navigator as any).onLine = true;
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ superadmin: false }) });
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(user);
  await vi.waitFor(() => expect(w.readOnly).toBe(false));
  mocks.download.mockRejectedValue(new ApiError('Revoked', 403));
  await w.prepareOffline();
  expect(w.canRead).toBe(false);
  expect(w.offlineSnapshot).toBeNull();
  expect(mocks.stored).toBeNull();
});

it('does not show login until persistent logout has completed', async () => {
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(user);
  await vi.waitFor(() => expect(w.access).toBe('local'));
  let complete: () => void = () => {};
  mocks.clear.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      })
  );
  const pending = w.logout();
  expect(w.access).toBe('loading');
  complete();
  await pending;
  await vi.waitFor(() => expect(w.access).toBe('login'));
});

it('a late successful verification cannot reopen data after an explicit revocation', async () => {
  (navigator as any).onLine = true;
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ superadmin: false }) });
  const w = new Workspace();
  dispose = w.start();
  mocks.listener!(user);
  await vi.waitFor(() => expect(w.ready).toBe(true));
  let respond: (value: unknown) => void = () => {};
  mocks.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        respond = resolve;
      })
  );
  const checking = w.retryAccess();
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  mocks.watch.mock.calls[0][3](new ApiError('Revoked', 403));
  await vi.waitFor(() => expect(w.access).toBe('denied'));
  respond({ ok: true, json: async () => ({ superadmin: false }) });
  await checking;
  expect(w.canRead).toBe(false);
  expect(w.offlineSnapshot).toBeNull();
});
