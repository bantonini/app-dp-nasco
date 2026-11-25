import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Dossier, FileRef } from '../dossier';
import type { Repository } from './types';

const BUCKET = 'dossiers';
let client: SupabaseClient | null = null;

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function getSupabase(): SupabaseClient | null {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  client ??= createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/**
 * Stockage Supabase : table `dossiers` (voir supabase/schema.sql) et
 * bucket privé `dossiers` pour les photos et images générées.
 */
export function createSupabaseRepository(sb: SupabaseClient): Repository {
  const fail = (e: { message: string; code?: string } | null) => {
    if (!e) return;
    // 42501 : droits manquants sur la table (schema.sql pas ou partiellement exécuté).
    if (e.code === '42501' || /permission denied/i.test(e.message))
      throw new Error(
        "Accès refusé à la table des dossiers. Exécutez à nouveau supabase/schema.sql dans Supabase (SQL Editor), puis rechargez la page.",
      );
    if (e.code === '42P01' || /relation .* does not exist|Could not find the table/i.test(e.message))
      throw new Error('La table des dossiers n’existe pas encore. Exécutez supabase/schema.sql dans Supabase (SQL Editor).');
    throw new Error(e.message);
  };
  return {
    kind: 'supabase',
    async list() {
      const { data, error } = await sb.from('dossiers').select('data').order('updated_at', { ascending: false });
      fail(error);
      return (data ?? []).map((r) => r.data as Dossier);
    },
    async get(id) {
      const { data, error } = await sb.from('dossiers').select('data').eq('id', id).maybeSingle();
      fail(error);
      return (data?.data as Dossier) ?? null;
    },
    async save(d) {
      const { error } = await sb
        .from('dossiers')
        .upsert({ id: d.id, reference: d.reference, status: d.status, data: d, updated_at: d.updatedAt });
      fail(error);
    },
    async remove(id) {
      const { data: objects } = await sb.storage.from(BUCKET).list(id, { limit: 1000 });
      if (objects?.length) await sb.storage.from(BUCKET).remove(objects.map((o) => `${id}/${o.name}`));
      const { error } = await sb.from('dossiers').delete().eq('id', id);
      fail(error);
    },
    async nextSequence() {
      const { count, error } = await sb.from('dossiers').select('id', { count: 'exact', head: true });
      fail(error);
      return (count ?? 0) + 1;
    },
    async putFile(dossierId, blob, meta) {
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const ref: FileRef = { ...meta, key: `${crypto.randomUUID()}.${ext}`, type: blob.type };
      const { error } = await sb.storage.from(BUCKET).upload(`${dossierId}/${ref.key}`, blob, { contentType: blob.type });
      fail(error);
      return ref;
    },
    async getFile(dossierId, ref) {
      const { data, error } = await sb.storage.from(BUCKET).download(`${dossierId}/${ref.key}`);
      if (error) return null;
      return data;
    },
  };
}
