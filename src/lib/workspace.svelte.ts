import { getContext, setContext } from 'svelte';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import { getFirebase } from './firebase';
import { collections, type Dataset, type Entity } from './fields';
import { watchCollection } from './repository';

const key = Symbol('workspace');

export class Workspace {
  client: ReturnType<typeof getFirebase> = null;
  user = $state<User | null>(null);
  access = $state<'loading' | 'setup' | 'login' | 'denied' | 'member'>('loading');
  data = $state<Dataset>({});
  members = $state<Entity[]>([]);
  assignees = $state<Entity[]>([]);
  loaded = $state<string[]>([]);
  superadmin = $state(false);
  online = $state(true);
  error = $state('');
  message = $state('');
  ready = $derived(this.access === 'member' && this.loaded.length === collections.length + 2);

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
    if (this.client) await signOut(this.client.auth);
  }

  start() {
    this.online = navigator.onLine;
    const network = () => {
      this.online = navigator.onLine;
    };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    const removeNetwork = () => {
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
    };
    try {
      this.client = getFirebase();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
    if (!this.client) {
      this.access = 'setup';
      return removeNetwork;
    }
    const client = this.client;
    let generation = 0;
    let verifying: number | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let subscriptions: (() => void)[] = [];
    const stop = () => {
      subscriptions.forEach((fn) => fn());
      subscriptions = [];
    };
    const clear = () => {
      this.data = {};
      this.members = [];
      this.assignees = [];
      this.loaded = [];
      this.superadmin = false;
      this.message = '';
    };
    const deny = (error: unknown) => {
      stop();
      clear();
      this.access = 'denied';
      this.error = error instanceof Error ? error.message : String(error);
    };
    const verify = async (user: User, version: number) => {
      if (verifying === version) return;
      verifying = version;
      try {
        const response = await fetch('/api/access', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + (await user.getIdToken()) },
          cache: 'no-store'
        });
        const result = await response.json();
        if (version !== generation) return;
        if (!response.ok) {
          const error = result.message || result.error || 'Accesso non consentito.';
          if (response.status >= 500 && this.access === 'member') {
            this.error = error;
            return;
          }
          deny(error);
          return;
        }
        this.error = '';
        this.superadmin = result.superadmin === true;
        if (this.access === 'member') return;
        this.access = 'member';
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
              (error) => {
                if (version === generation) deny(error);
              }
            )
          );
        }
      } catch {
        if (version === generation) {
          if (this.access === 'member')
            this.error =
              'Controllo accesso temporaneamente non disponibile. La bozza è conservata; riprova quando torna la connessione.';
          else deny('Serve una connessione per verificare l’accesso. Riprova tra poco.');
        }
      } finally {
        if (verifying === version) verifying = null;
      }
    };
    const unsubscribe = onAuthStateChanged(client.auth, (user) => {
      const version = ++generation;
      clearInterval(timer);
      stop();
      clear();
      this.error = '';
      this.user = user;
      if (!user) {
        this.access = 'login';
        return;
      }
      this.access = 'loading';
      void verify(user, version);
      timer = setInterval(() => void verify(user, version), 60_000);
    });
    return () => {
      generation++;
      unsubscribe();
      clearInterval(timer);
      stop();
      removeNetwork();
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
