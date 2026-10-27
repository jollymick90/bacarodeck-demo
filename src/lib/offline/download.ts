import { collections, type Entity } from '../fields';
import { offlineCollections, type OfflineSnapshot } from './snapshot';
export type PackageManifest = { versions: Record<string, string> };
export type PackagePage = { version: string; entities: Entity[]; next: number | null };
export async function downloadSnapshot(
  request: (query: string) => Promise<unknown>,
  identity: Pick<OfflineSnapshot, 'scope' | 'identity' | 'verifiedAt'>,
  onprogress: (completed: number, total: number) => void,
  signal: AbortSignal
): Promise<OfflineSnapshot> {
  const check = () => signal.throwIfAborted();
  check();
  const manifest = (await request('')) as PackageManifest;
  check();
  const records: Record<string, Entity[]> = {};
  for (const [index, name] of offlineCollections.entries()) {
    if (typeof manifest.versions?.[name] !== 'string')
      throw new Error('Pacchetto offline non valido.');
    const entities: Entity[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      check();
      const query = new URLSearchParams({
        collection: name,
        offset: String(offset),
        version: manifest.versions[name]
      });
      const page = (await request(query.toString())) as PackagePage;
      check();
      if (page.version !== manifest.versions[name])
        throw new Error('I dati sono cambiati durante il download. Riprova.');
      if (
        !Array.isArray(page.entities) ||
        (page.next !== null && (!Number.isInteger(page.next) || page.next <= offset))
      )
        throw new Error('Pagina offline non valida.');
      entities.push(...page.entities);
      offset = page.next;
    }
    records[name] = entities;
    onprogress(index + 1, offlineCollections.length);
  }
  const final = (await request('')) as PackageManifest;
  check();
  if (offlineCollections.some((c) => final.versions?.[c] !== manifest.versions[c]))
    throw new Error('I dati sono cambiati durante il download. Riprova.');
  return {
    version: 1,
    ...identity,
    downloadedAt: Date.now(),
    data: Object.fromEntries(collections.map((c) => [c, records[c]])),
    members: records.members
  };
}
