import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { prepareOfflineShell } from '../src/lib/offline/shell';

class TestWorker extends EventTarget {
  state: ServiceWorkerState;
  constructor(
    state: ServiceWorkerState,
    private responds = true
  ) {
    super();
    this.state = state;
  }
  postMessage(_message: unknown, ports: MessagePort[]) {
    if (!this.responds) return; // The previously deployed worker has no message handler.
    this.state = 'activated';
    this.dispatchEvent(new Event('statechange'));
    ports[0].postMessage({ ready: true });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  // Deliver messages across the browser boundary without depending on Node's event loop.
  vi.stubGlobal(
    'MessageChannel',
    class {
      port1 = { onmessage: null as any, close() {} };
      port2 = {
        postMessage: (data: unknown) => queueMicrotask(() => this.port1.onmessage?.({ data })),
        close() {}
      };
    }
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('prepares using the updated waiting worker instead of timing out on the legacy active worker', async () => {
  const registration = {
    active: new TestWorker('activated', false),
    waiting: new TestWorker('installed'),
    installing: null,
    update: async () => {}
  };
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve(registration) } });
  const result = prepareOfflineShell().then(
    () => 'ready',
    (error: Error) => error.message
  );
  await vi.runAllTimersAsync();
  expect(await result).toBe('ready');
  expect(vi.getTimerCount()).toBe(0);
});

it('waits for an update that is still installing before preparing the device', async () => {
  const installing = new TestWorker('installing');
  const registration = {
    active: new TestWorker('activated', false),
    waiting: null,
    installing,
    update: async () => {
      setTimeout(() => {
        installing.state = 'installed';
        installing.dispatchEvent(new Event('statechange'));
      }, 100);
    }
  };
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve(registration) } });
  const result = prepareOfflineShell().then(
    () => 'ready',
    (error: Error) => error.message
  );
  await vi.runAllTimersAsync();
  expect(await result).toBe('ready');
});

it('still prepares a current active worker when no update is waiting', async () => {
  vi.stubGlobal('navigator', {
    serviceWorker: {
      ready: Promise.resolve({
        active: new TestWorker('activated'),
        waiting: null,
        installing: null,
        update: async () => {}
      })
    }
  });
  const result = prepareOfflineShell();
  await vi.runAllTimersAsync();
  await expect(result).resolves.toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

it('reports a failed app update instead of waiting on an obsolete worker', async () => {
  vi.stubGlobal('navigator', {
    serviceWorker: {
      ready: Promise.resolve({
        active: new TestWorker('activated', false),
        waiting: null,
        installing: null,
        update: async () => {
          throw new TypeError('Failed to fetch');
        }
      })
    }
  });
  const result = prepareOfflineShell().then(
    () => 'ready',
    (error: Error) => error.message
  );
  await vi.runAllTimersAsync();
  expect(await result).toMatch(/Impossibile aggiornare.*connessione/);
});

it('gives recovery instructions when the installed worker cannot answer', async () => {
  vi.stubGlobal('navigator', {
    serviceWorker: {
      ready: Promise.resolve({
        active: new TestWorker('activated', false),
        waiting: null,
        installing: null,
        update: async () => {}
      })
    }
  });
  const result = prepareOfflineShell().then(
    () => 'ready',
    (error: Error) => error.message
  );
  await vi.runAllTimersAsync();
  expect(await result).toMatch(/Chiudi.*PWA.*online/);
});

it('does not finish preparation until the updated worker has activated', async () => {
  const worker = new TestWorker('installed');
  worker.postMessage = (_message: unknown, ports: MessagePort[]) => {
    worker.state = 'activating';
    ports[0].postMessage({ ready: true });
    setTimeout(() => {
      worker.state = 'activated';
      worker.dispatchEvent(new Event('statechange'));
    }, 1000);
  };
  vi.stubGlobal('navigator', {
    serviceWorker: {
      ready: Promise.resolve({
        active: new TestWorker('activated', false),
        waiting: worker,
        installing: null,
        update: async () => {}
      })
    }
  });
  let finished = false;
  const preparing = prepareOfflineShell().then(() => {
    finished = true;
  });
  await vi.advanceTimersByTimeAsync(100);
  expect(finished).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  await preparing;
  expect(finished).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
