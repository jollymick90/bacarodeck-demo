import { validSnapshot, type OfflineSnapshot } from './snapshot';
const database = 'bacarodeck-offline-v1';
export class OfflineStore {
  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('snapshots');
        request.result.createObjectStore('leases');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error('Memoria locale occupata da un’altra scheda. Chiudila e riprova.'));
    });
  }
  private async transaction<T>(
    mode: IDBTransactionMode,
    action: (tx: IDBTransaction, done: (value: T) => void) => void,
    signal?: AbortSignal
  ): Promise<T> {
    signal?.throwIfAborted();
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(['snapshots', 'leases'], mode);
      let value: T;
      const abort = () => tx.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const close = () => {
        signal?.removeEventListener('abort', abort);
        db.close();
      };
      tx.oncomplete = () => {
        close();
        resolve(value);
      };
      tx.onabort = tx.onerror = () => {
        close();
        reject(tx.error || new Error('Salvataggio locale interrotto.'));
      };
      try {
        signal?.throwIfAborted();
        action(tx, (result) => {
          value = result;
        });
      } catch (error) {
        tx.abort();
        close();
        reject(error);
      }
    });
  }
  async load(scope: string): Promise<OfflineSnapshot | null> {
    return this.transaction('readonly', (tx, done) => {
      const snapshot = tx.objectStore('snapshots').get(scope);
      const lease = tx.objectStore('leases').get(scope);
      lease.onsuccess = () => {
        const value = snapshot.result;
        if (
          !validSnapshot(value) ||
          value.scope !== scope ||
          lease.result?.uid !== value.identity.uid
        ) {
          done(null);
          return;
        }
        done({ ...value, verifiedAt: lease.result.verifiedAt });
      };
    });
  }
  async save(snapshot: OfflineSnapshot, signal?: AbortSignal) {
    if (!validSnapshot(snapshot)) throw new Error('Copia offline incompleta.');
    await this.transaction<void>(
      'readwrite',
      (tx) => {
        tx.objectStore('snapshots').put(snapshot, snapshot.scope);
        tx.objectStore('leases').put(
          { uid: snapshot.identity.uid, verifiedAt: snapshot.verifiedAt },
          snapshot.scope
        );
      },
      signal
    );
  }
  async renew(scope: string, uid: string, verifiedAt: number) {
    await this.transaction<void>('readwrite', (tx) => {
      const store = tx.objectStore('leases');
      const current = store.get(scope);
      current.onsuccess = () => {
        if (current.result?.uid === uid) store.put({ uid, verifiedAt }, scope);
      };
    });
  }
  async clear(scope: string) {
    await this.transaction<void>('readwrite', (tx) => {
      tx.objectStore('snapshots').delete(scope);
      tx.objectStore('leases').delete(scope);
    });
  }
}
