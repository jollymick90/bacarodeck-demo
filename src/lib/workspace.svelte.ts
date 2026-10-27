import { getContext, setContext } from 'svelte';
import { env } from '$env/dynamic/public';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import { getFirebase, workspaceId } from './firebase';
import { collections, type Dataset, type Entity } from './fields';
import { api, ApiError, setWriteAccess, watchCollection } from './repository';
import { OfflineStore } from './offline/storage';
import {
  offlineAccess,
  offlineCollections,
  offlineLifetime,
  type OfflineSnapshot
} from './offline/snapshot';
import { offlineRecovery } from './offline/session';
import { downloadSnapshot } from './offline/download';
import { prepareOfflineShell } from './offline/shell';
import type { GraphResponse } from './connections/types';
const key = Symbol('workspace');
const refreshInterval = 5 * 60 * 1000;

export class Workspace {
  client: ReturnType<typeof getFirebase> = null;
  user = $state<User | null>(null);
  access = $state<'loading' | 'setup' | 'login' | 'denied' | 'member' | 'local'>('loading');
  data = $state<Dataset>({});
  connections = $state<GraphResponse | null>(null);
  members = $state<Entity[]>([]);
  assignees = $state<Entity[]>([]);
  loaded = $state<string[]>([]);
  superadmin = $state(false);
  online = $state(true);
  verifiedOnline = $state(false);
  checkingAccess = $state(false);
  offlineSnapshot = $state<OfflineSnapshot | null>(null);
  preparing = $state(false);
  progress = $state('');
  offlineError = $state('');
  persistentStorage = $state<boolean | null>(null);
  error = $state('');
  message = $state('');
  identityUid = $derived(this.user?.uid || this.offlineSnapshot?.identity.uid || '');
  readOnly = $derived(!this.online || !this.verifiedOnline || this.access !== 'member');
  canRead = $derived(this.access === 'member' || this.access === 'local');
  ready = $derived(this.canRead && this.loaded.length === collections.length + 2);
  private store = new OfflineStore();
  private scope = '';
  private verifiedAt = 0;
  private lastDownloadAttempt = 0;
  private accessFailure: ((status: number, message: string) => Promise<void>) | null = null;
  private downloadController: AbortController | null = null;
  private verifyNow: (() => Promise<void>) | null = null;
  private reset: (() => void) | null = null;

  async login() {
    if (!this.client) return;
    this.error = '';
    try {
      await signInWithPopup(this.client.auth, new GoogleAuthProvider());
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }
  async logout() {
    this.reset?.();
    this.access = 'loading';
    try {
      await this.store.clear(this.scope);
      this.offlineSnapshot = null;
      if (this.client) await signOut(this.client.auth);
      this.user = null;
      this.access = 'login';
    } catch {
      this.access = 'denied';
      this.error = 'Impossibile cancellare la copia locale. Riprova prima di uscire.';
    }
  }
  async retryAccess() {
    await this.verifyNow?.();
  }
  async prepareOffline(automatic = false) {
    if (this.preparing || this.readOnly || !this.user) return;
    if (automatic && Date.now() - this.lastDownloadAttempt < refreshInterval) return;
    this.lastDownloadAttempt = Date.now();
    const uid = this.user.uid;
    const controller = new AbortController();
    this.downloadController = controller;
    this.preparing = true;
    this.offlineError = '';
    try {
      if (!automatic && navigator.storage?.persist)
        this.persistentStorage = await navigator.storage.persist().catch(() => false);
      this.progress = 'Preparazione delle risorse dell’app…';
      await prepareOfflineShell();
      controller.signal.throwIfAborted();
      let snapshot: OfflineSnapshot | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          snapshot = await downloadSnapshot(
            (query) => api('/api/offline' + (query ? '?' + query : '')),
            {
              scope: this.scope,
              identity: { uid, displayName: this.user.displayName, email: this.user.email },
              verifiedAt: this.verifiedAt
            },
            (done, total) => {
              this.progress = `Download dei contenuti: ${done} / ${total}`;
            },
            controller.signal
          );
          break;
        } catch (failure) {
          if (attempt === 0 && failure instanceof Error && /cambiati/.test(failure.message))
            continue;
          throw failure;
        }
      }
      controller.signal.throwIfAborted();
      if (!snapshot || this.readOnly || this.user?.uid !== uid)
        throw new Error('Verifica di nuovo l’accesso prima di scaricare.');
      snapshot.verifiedAt = this.verifiedAt;
      await this.store.save(snapshot, controller.signal);
      controller.signal.throwIfAborted();
      this.offlineSnapshot = snapshot;
      this.progress = '';
    } catch (e) {
      if (!controller.signal.aborted) {
        this.offlineError = e instanceof Error ? e.message : String(e);
        if (e instanceof ApiError && (e.status === 401 || e.status === 403))
          await this.accessFailure?.(e.status, e.message);
      }
    } finally {
      if (this.downloadController === controller) {
        this.preparing = false;
        this.downloadController = null;
      }
    }
  }

  start() {
    this.online = navigator.onLine;
    this.scope = [
      env.PUBLIC_FIREBASE_PROJECT_ID,
      workspaceId,
      env.PUBLIC_USE_EMULATORS || 'false',
      location.origin
    ].join(':');
    setWriteAccess(false);
    const loadLocal = () =>
      this.store.load(this.scope).catch(() => {
        this.offlineError =
          'Memoria locale non disponibile: impossibile recuperare la copia offline.';
        return null;
      });
    try {
      this.client = getFirebase();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
    if (!this.client) {
      this.access = 'setup';
      return () => {};
    }
    const client = this.client;
    let generation = 0;
    let verifying: number | null = null;
    let subscriptions: (() => void)[] = [];
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      subscriptions.forEach((fn) => fn());
      subscriptions = [];
    };
    const lock = () => {
      this.verifiedOnline = false;
      setWriteAccess(false);
      this.superadmin = false;
    };
    const clear = () => {
      this.checkingAccess = false;
      this.data = {};
      this.connections = null;
      this.members = [];
      this.assignees = [];
      this.loaded = [];
      this.message = '';
    };
    const cancelDownload = () => {
      this.downloadController?.abort();
      this.downloadController = null;
      this.preparing = false;
      this.progress = '';
    };
    const deny = (message: string) => {
      stop();
      lock();
      cancelDownload();
      clear();
      this.access = 'denied';
      this.error = message;
    };
    const restore = (snapshot: OfflineSnapshot) => {
      this.checkingAccess = false;
      this.offlineSnapshot = snapshot;
      this.data = JSON.parse(JSON.stringify(snapshot.data));
      this.members = JSON.parse(JSON.stringify(snapshot.members));
      this.assignees = snapshot.members.map((m) => ({
        id: m.id,
        uid: m.id,
        displayName: m.displayName || m.id
      }));
      this.loaded = [...offlineCollections, 'assignees'];
      this.access = 'local';
      this.error = '';
    };
    const recover = async (status: number, message: string, version: number) => {
      if (version !== generation) return;
      stop();
      lock();
      cancelDownload();
      const result = offlineRecovery(
        this.offlineSnapshot,
        this.scope,
        this.user?.uid || null,
        status
      );
      if (result === 'clear') {
        // Older authorization responses must not undo an explicit revocation.
        generation++;
        deny(message);
        this.offlineSnapshot = null;
        await this.store.clear(this.scope).catch(() => {});
      } else if (result === 'read' && this.offlineSnapshot) restore(this.offlineSnapshot);
      else if (
        status !== 403 &&
        !this.offlineSnapshot &&
        this.loaded.length === collections.length + 2
      ) {
        this.access = 'member';
        this.checkingAccess = false;
        this.error = message;
      } else deny(message);
    };
    this.accessFailure = (status, message) => recover(status, message, generation);
    const verify = async (user: User, version: number) => {
      if (verifying === version) return;
      verifying = version;
      try {
        const response = await fetch('/api/access', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + (await user.getIdToken()) },
          cache: 'no-store',
          signal: AbortSignal.timeout(10000)
        });
        if (version !== generation) return;
        const result = await response.json();
        if (version !== generation) return;
        if (!response.ok) {
          await recover(
            response.status,
            result.message || result.error || 'Accesso non consentito.',
            version
          );
          return;
        }
        this.checkingAccess = false;
        this.verifiedAt = Date.now();
        this.verifiedOnline = true;
        setWriteAccess(this.online);
        this.superadmin = result.superadmin === true;
        this.error = '';
        this.access = 'member';
        if (this.offlineSnapshot?.identity.uid === user.uid) {
          this.offlineSnapshot.verifiedAt = this.verifiedAt;
          void this.store.renew(this.scope, user.uid, this.verifiedAt).catch(() => {});
        }
        if (!subscriptions.length) {
          for (const name of [...collections, 'members', 'assignees'] as const) {
            subscriptions.push(
              watchCollection(
                client.db,
                name,
                (entities, cached) => {
                  if (version !== generation || this.access !== 'member') return;
                  if (name === 'members') this.members = entities;
                  else if (name === 'assignees') this.assignees = entities;
                  else this.data[name] = entities;
                  if (!cached && !this.loaded.includes(name)) this.loaded = [...this.loaded, name];
                },
                (failure) => {
                  if (version === generation)
                    void recover(
                      failure instanceof ApiError ? failure.status : 0,
                      failure.message,
                      version
                    );
                }
              )
            );
          }
        }
        if (
          this.offlineSnapshot &&
          Date.now() - this.offlineSnapshot.downloadedAt >= refreshInterval
        )
          void this.prepareOffline(true);
      } catch {
        if (version === generation)
          await recover(
            0,
            'Connessione non disponibile. Prepara il dispositivo online per consultare i dati senza rete.',
            version
          );
      } finally {
        if (verifying === version) verifying = null;
      }
    };
    const check = async () => {
      if (this.user && this.online) await verify(this.user, generation);
      else if (
        this.access === 'local' &&
        !offlineAccess(this.offlineSnapshot, this.scope, this.user?.uid || null)
      )
        deny('Accesso offline scaduto: riconnettiti e verifica l’accesso.');
    };
    this.verifyNow = check;
    const network = () => {
      this.online = navigator.onLine;
      lock();
      cancelDownload();
      if (this.online) {
        // Do not expose a possibly revoked snapshot during revalidation.
        this.checkingAccess = this.ready;
        if (this.user) void check();
        else if (offlineAccess(this.offlineSnapshot, this.scope, null) && this.offlineSnapshot)
          restore(this.offlineSnapshot);
      } else if (
        this.offlineSnapshot &&
        offlineAccess(this.offlineSnapshot, this.scope, this.user?.uid || null)
      ) {
        stop();
        restore(this.offlineSnapshot);
      }
    };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    const unsubscribe = onAuthStateChanged(client.auth, (user) => {
      const version = ++generation;
      stop();
      lock();
      cancelDownload();
      clear();
      this.error = '';
      this.user = user;
      this.access = 'loading';
      void (async () => {
        const snapshot = await loadLocal();
        if (version !== generation) return;
        if (snapshot && user && snapshot.identity.uid !== user.uid) {
          this.offlineSnapshot = null;
          await this.store.clear(this.scope).catch(() => {});
          if (version !== generation) return;
        } else this.offlineSnapshot = snapshot;
        if (!user) {
          if (offlineAccess(this.offlineSnapshot, this.scope, null) && this.offlineSnapshot)
            restore(this.offlineSnapshot);
          else this.access = 'login';
        } else if (this.online) await verify(user, version);
        else
          await recover(
            0,
            'Per il primo accesso offline devi preparare questo dispositivo quando hai rete.',
            version
          );
      })();
    });
    timer = setInterval(() => void check(), 60000);
    this.reset = () => {
      ++generation;
      lock();
      stop();
      cancelDownload();
      clear();
      this.offlineSnapshot = null;
      this.access = 'login';
    };
    return () => {
      ++generation;
      unsubscribe();
      clearInterval(timer);
      stop();
      lock();
      cancelDownload();
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      this.accessFailure = null;
      this.verifyNow = null;
      this.reset = null;
    };
  }
}
export function provideWorkspace() {
  const workspace = new Workspace();
  setContext(key, workspace);
  return workspace;
}
export function getWorkspace(): Workspace {
  return getContext<Workspace>(key);
}
