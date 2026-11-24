import { createStore, del, entries, get, set } from 'idb-keyval';
import type { Dossier, FileRef } from '../dossier';
import type { Repository } from './types';

/**
 * Stockage dans le navigateur (IndexedDB). Sert de mode démo / hors-ligne
 * quand Supabase n'est pas configuré.
 */
export function createLocalRepository(): Repository {
  const dossiers = createStore('nasco-dp', 'dossiers');
  const files = createStore('nasco-dp-files', 'files');
  return {
    kind: 'local',
    async list() {
      const all = await entries<string, Dossier>(dossiers);
      return all.map(([, d]) => d).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    get: (id) => get<Dossier>(id, dossiers).then((d) => d ?? null),
    save: (d) => set(d.id, d, dossiers),
    async remove(id) {
      await del(id, dossiers);
      const all = await entries<string, Blob>(files);
      await Promise.all(all.filter(([k]) => k.startsWith(`${id}/`)).map(([k]) => del(k, files)));
    },
    async nextSequence() {
      return (await entries(dossiers)).length + 1;
    },
    async putFile(dossierId, blob, meta) {
      const ref: FileRef = { ...meta, key: `${crypto.randomUUID()}`, type: blob.type };
      await set(`${dossierId}/${ref.key}`, blob, files);
      return ref;
    },
    getFile: (dossierId, ref) => get<Blob>(`${dossierId}/${ref.key}`, files).then((b) => b ?? null),
  };
}
