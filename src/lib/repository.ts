import { getAuth } from 'firebase/auth';
import type { Firestore, Unsubscribe } from 'firebase/firestore';
import type { Change } from './domain';
import { collections, type Collection, type Entity } from './fields';
export const basePath = 'workspaces/codemotion-milano-2026';
const refresh = new EventTarget();
export function refreshWorkspace() {
  refresh.dispatchEvent(new CustomEvent('change', { detail: [...collections, 'members'] }));
}
export function refreshData() {
  refresh.dispatchEvent(new CustomEvent('change', { detail: ['questions'] }));
}
async function api(path: string, body?: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw new Error('Sei offline. Conserva il testo e riprova quando torna la connessione.');
  const user = getAuth().currentUser;
  if (!user) throw new Error('Accedi con Google.');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || result.error || 'Operazione non riuscita.');
  return result;
}
export async function commitChanges(
  _db: Firestore,
  _uid: string,
  changes: Change[],
  origin: 'manual' | 'import' = 'manual'
): Promise<void> {
  if (!changes.length) return;
  await api('/api/data', { action: 'save', changes, origin });
  refresh.dispatchEvent(
    new CustomEvent('change', { detail: [...new Set(changes.map((change) => change.collection))] })
  );
}
export async function removeEntity(
  _db: Firestore,
  collection: Collection,
  entity: Entity
): Promise<void> {
  await api('/api/data', {
    action: 'delete',
    changes: [{ collection, data: entity, expectedRevision: entity.revision }]
  });
  refresh.dispatchEvent(new CustomEvent('change', { detail: [collection] }));
}
export function watchCollection(
  _db: Firestore,
  name: Collection | 'members',
  ondata: (entities: Entity[], cached: boolean) => void,
  onerror: (error: Error) => void
): Unsubscribe {
  let active = true;
  let generation = 0;
  async function load() {
    const current = ++generation;
    try {
      const result = await api(`/api/data/${name}`);
      if (active && current === generation) ondata(result, false);
    } catch (failure) {
      if (active && current === generation) onerror(failure as Error);
    }
  }
  void load();
  function poll() {
    if (document.visibilityState === 'visible' && navigator.onLine) void load();
  }
  function changed(event: Event) {
    if ((event as CustomEvent<string[]>).detail.includes(name)) void load();
  }
  const timer = setInterval(poll, 60_000);
  document.addEventListener('visibilitychange', poll);
  window.addEventListener('online', poll);
  refresh.addEventListener('change', changed);
  return () => {
    active = false;
    clearInterval(timer);
    refresh.removeEventListener('change', changed);
    document.removeEventListener('visibilitychange', poll);
    window.removeEventListener('online', poll);
  };
}

export async function restorePersonalRatings(votes: { questionId: string; score: number }[]) {
  for (const vote of votes) {
    await api(`/api/questions/${encodeURIComponent(vote.questionId)}/rating`, {
      score: vote.score
    });
  }
  if (votes.length) refreshData();
}
