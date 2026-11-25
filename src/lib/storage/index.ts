import { createLocalRepository } from './local';
import { createSupabaseRepository, getSupabase } from './supabase';
import type { Repository } from './types';

export type { Repository };

let repo: Repository | null = null;

/** Dépôt actif : Supabase si configuré, sinon stockage local du navigateur. */
export function repository(): Repository {
  if (!repo) {
    const sb = getSupabase();
    repo = sb ? createSupabaseRepository(sb) : createLocalRepository();
  }
  return repo;
}
