-- =============================================================================
-- NIRA CRM — Présentations et propositions générées
-- =============================================================================
-- À exécuter dans l'éditeur SQL de Supabase, après 002-auth-multi-tenant.sql.
-- Idempotent : peut être rejoué sans risque.
--
-- Chaque génération (présentation, proposition, documentation technique) est
-- conservée avec le lead : on la rouvre ou on la réimprime sans repayer la
-- génération. Le contenu est stocké en JSON et remis en page à l'ouverture,
-- si bien qu'une amélioration des gabarits profite aussi aux anciens dossiers.
-- =============================================================================

create table if not exists public.proposals (
    id text primary key default gen_random_uuid()::text,
    "leadId" text not null references public.leads(id) on delete cascade,
    owner_id uuid references auth.users(id) on delete set null default auth.uid(),
    -- Saisie du commercial : offre, prix, facturation, transcription…
    input jsonb not null default '{}'::jsonb,
    -- Logo (data URL) et couleurs du client.
    brand jsonb not null default '{}'::jsonb,
    -- Analyse, présentation, proposition et documentation technique.
    content jsonb not null default '{}'::jsonb,
    "createdAt" timestamptz not null default now()
);

create index if not exists idx_proposals_lead on public.proposals("leadId");

-- RLS : une génération suit les droits de son lead.
alter table public.proposals enable row level security;

drop policy if exists "proposals_owner_access" on public.proposals;
create policy "proposals_owner_access" on public.proposals
  for all to authenticated
  using (
    public.is_active() and exists (
      select 1 from public.leads l
      where l.id = proposals."leadId" and (l.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    public.is_active() and exists (
      select 1 from public.leads l
      where l.id = proposals."leadId" and (l.owner_id = auth.uid() or public.is_admin())
    )
  );

-- Contrôle
select count(*) as propositions from public.proposals;
