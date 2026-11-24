import type { Dossier, FileRef } from '../dossier';

export interface Repository {
  readonly kind: 'local' | 'supabase';
  list(): Promise<Dossier[]>;
  get(id: string): Promise<Dossier | null>;
  save(dossier: Dossier): Promise<void>;
  remove(id: string): Promise<void>;
  nextSequence(): Promise<number>;
  putFile(dossierId: string, blob: Blob, meta: Omit<FileRef, 'key' | 'type'>): Promise<FileRef>;
  getFile(dossierId: string, ref: FileRef): Promise<Blob | null>;
}
