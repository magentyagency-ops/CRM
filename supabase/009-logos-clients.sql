-- =============================================================================
-- NIRA CRM — Logos des entreprises, fiches clients et documents
-- =============================================================================
-- À exécuter dans l'éditeur SQL de Supabase, après 002-auth-multi-tenant.sql.
-- Idempotent : peut être rejoué sans risque.
--
-- 1. Chaque lead peut porter le site web de l'entreprise et l'adresse de son
--    logo, retrouvé automatiquement.
-- 2. Un client est une entreprise ayant au moins une vente gagnée ; plusieurs
--    ventes peuvent concerner le même client. Ses documents (contrats, devis,
--    factures…) sont rattachés à l'entreprise, et éventuellement à une vente.
-- 3. Les fichiers vivent dans un espace de stockage privé : on n'y accède
--    qu'avec les droits de la ligne qui les décrit.
-- =============================================================================

-- 1. Site web et logo -----------------------------------------------------------
alter table public.leads add column if not exists website text not null default '';
-- '' = pas encore cherché, 'none' = introuvable, sinon l'adresse de l'image.
alter table public.leads add column if not exists logo text not null default '';

-- 2. Documents clients --------------------------------------------------------
create table if not exists public.client_documents (
    id text primary key default gen_random_uuid()::text,
    -- Nom de l'entreprise normalisé (minuscules, espaces réduits) : la clé du client.
    company_key text not null,
    "leadId" text references public.leads(id) on delete set null,
    name text not null,
    category text not null default 'other'
      check (category in ('contract', 'quote', 'invoice', 'proposal', 'other')),
    -- Chemin du fichier dans l'espace de stockage « client-documents ».
    path text not null unique,
    size bigint not null default 0,
    mime text not null default '',
    owner_id uuid references auth.users(id) on delete set null default auth.uid(),
    "createdAt" timestamptz not null default now()
);

create index if not exists idx_client_documents_company on public.client_documents(company_key);

alter table public.client_documents enable row level security;

-- Un document est visible par l'admin, par celui qui l'a déposé, et par les
-- commerciaux qui suivent une vente de ce client.
drop policy if exists "client_documents_access" on public.client_documents;
create policy "client_documents_access" on public.client_documents
  for all to authenticated
  using (
    public.is_active() and (
      public.is_admin()
      or owner_id = auth.uid()
      or exists (
        select 1 from public.leads l
        where l.owner_id = auth.uid()
          and lower(regexp_replace(trim(l.company), '\s+', ' ', 'g')) = client_documents.company_key
      )
    )
  )
  with check (public.is_active() and (owner_id = auth.uid() or public.is_admin()));

-- 3. Espace de stockage privé ---------------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

-- Un fichier n'est accessible que si la ligne qui le décrit l'est : la ligne est
-- créée avant l'envoi du fichier, et supprimée après lui.
drop policy if exists "client_documents_files_read" on storage.objects;
create policy "client_documents_files_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (select 1 from public.client_documents d where d.path = storage.objects.name)
  );

drop policy if exists "client_documents_files_insert" on storage.objects;
create policy "client_documents_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and exists (select 1 from public.client_documents d where d.path = storage.objects.name)
  );

drop policy if exists "client_documents_files_delete" on storage.objects;
create policy "client_documents_files_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (select 1 from public.client_documents d where d.path = storage.objects.name)
  );

-- Contrôle
select count(*) filter (where stage = 'won') as ventes_gagnees,
       count(distinct lower(trim(company))) filter (where stage = 'won') as clients
from public.leads;
