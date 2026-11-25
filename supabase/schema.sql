-- Schéma Supabase de l'application DP NASCO.
-- À exécuter une fois dans Supabase → SQL Editor → New query → Run.

create table if not exists public.dossiers (
  id uuid primary key,
  reference text not null,
  status text not null default 'brouillon',
  data jsonb not null,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dossiers_updated_at_idx on public.dossiers (updated_at desc);

-- Les dossiers sont partagés entre tous les membres connectés de l'équipe.
alter table public.dossiers enable row level security;

drop policy if exists "Équipe : lecture" on public.dossiers;
create policy "Équipe : lecture" on public.dossiers for select to authenticated using (true);
drop policy if exists "Équipe : création" on public.dossiers;
create policy "Équipe : création" on public.dossiers for insert to authenticated with check (true);
drop policy if exists "Équipe : modification" on public.dossiers;
create policy "Équipe : modification" on public.dossiers for update to authenticated using (true);
drop policy if exists "Équipe : suppression" on public.dossiers;
create policy "Équipe : suppression" on public.dossiers for delete to authenticated using (true);

-- Bucket privé pour les photos et images générées (un dossier = un répertoire).
insert into storage.buckets (id, name, public)
values ('dossiers', 'dossiers', false)
on conflict (id) do nothing;

drop policy if exists "Équipe : fichiers" on storage.objects;
create policy "Équipe : fichiers" on storage.objects for all to authenticated
  using (bucket_id = 'dossiers') with check (bucket_id = 'dossiers');
