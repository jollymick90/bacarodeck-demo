export async function prepareOfflineShell() {
  if (!('serviceWorker' in navigator))
    throw new Error('Questo browser non supporta la riapertura offline.');
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error('Risorse offline non disponibili. Ricarica l’app online e riprova.')),
        15000
      )
    )
  ]);
  const worker = registration.active;
  if (!worker) throw new Error('Risorse offline non ancora pronte.');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Preparazione offline interrotta. Riprova.'));
    }, 30000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.ready) resolve();
      else reject(new Error(event.data?.error || 'Risorse offline non disponibili.'));
    };
    worker.postMessage({ type: 'PREPARE_OFFLINE' }, [channel.port2]);
  });
}
