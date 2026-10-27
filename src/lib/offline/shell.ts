async function withTimeout<T>(
  operation: Promise<T>,
  duration: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), duration);
      })
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

async function waitForWorker(worker: ServiceWorker, states: ServiceWorkerState[]) {
  let changed: () => void = () => {};
  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        changed = () => {
          if (states.includes(worker.state)) resolve();
          else if (worker.state === 'redundant')
            reject(
              new Error(
                'Installazione delle risorse offline non riuscita. Ricarica l’app online e riprova.'
              )
            );
        };
        worker.addEventListener('statechange', changed);
        changed();
      }),
      30000,
      'Aggiornamento dell’app non completato. Chiudi tutte le finestre della PWA, riaprila online e riprova.'
    );
  } finally {
    worker.removeEventListener('statechange', changed);
  }
}

export async function prepareOfflineShell() {
  if (!('serviceWorker' in navigator))
    throw new Error('Questo browser non supporta la riapertura offline.');
  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    15000,
    'Risorse offline non disponibili. Ricarica l’app online e riprova.'
  );
  try {
    await withTimeout(registration.update(), 15000, 'Aggiornamento non disponibile.');
  } catch {
    throw new Error(
      'Impossibile aggiornare le risorse dell’app. Controlla la connessione e riprova.'
    );
  }
  // ready may still refer to a legacy active worker that ignores PREPARE_OFFLINE.
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('Risorse offline non ancora pronte.');
  await waitForWorker(worker, ['installed', 'activated']);
  const channel = new MessageChannel();
  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        channel.port1.onmessage = (event) => {
          if (event.data?.ready) resolve();
          else reject(new Error(event.data?.error || 'Risorse offline non disponibili.'));
        };
        channel.port1.onmessageerror = () =>
          reject(new Error('Risposta dell’app non valida. Ricarica online e riprova.'));
        worker.postMessage({ type: 'PREPARE_OFFLINE' }, [channel.port2]);
      }),
      30000,
      'La versione dell’app sul dispositivo non risponde. Chiudi tutte le finestre della PWA, riaprila online e riprova.'
    );
  } finally {
    channel.port1.close();
    channel.port2.close();
  }
  // Do not mark the device ready while offline navigation is still handled by the old worker.
  await waitForWorker(worker, ['activated']);
}
