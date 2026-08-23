-- =============================================================================
-- NIRA CRM — Suivi des appels commerciaux (cold call)
-- =============================================================================
-- À exécuter dans l'éditeur SQL de Supabase APRÈS 002-auth-multi-tenant.sql.
-- Le script est idempotent : il peut être rejoué sans risque.
--
-- Reprend le classeur « Suivi_Appels_Commerciaux.xlsx » : une ligne par appel,
-- une feuille par commercial devient ici le cloisonnement par owner_id.
-- =============================================================================

create table if not exists public.calls (
    id text primary key default gen_random_uuid()::text,
    -- Jour de l'appel, au format AAAA-MM-JJ : un appel se compte par journée,
    -- jamais à la minute près, et la saisie se fait dans un champ date.
    date text not null default '',
    contact text not null default '',
    company text not null default '',
    phone text not null default '',
    outcome text not null default 'no-answer'
      check (outcome in ('no-answer', 'voicemail', 'answered')),
    conversation boolean not null default false,
    meeting boolean not null default false,
    "meetingAt" text not null default '',
    reason text not null default ''
      check (reason in ('', 'not-interested', 'no-budget', 'wrong-contact', 'bad-timing', 'has-provider', 'other')),
    objection text not null default ''
      check (objection in ('', 'price', 'no-need', 'timing', 'has-provider', 'decision-maker', 'other')),
    notes text not null default '',
    "nextAction" text not null default '',
    "followUpAt" text not null default '',
    -- Rattachement facultatif à une opportunité du pipeline : un appel abouti
    -- devient un lead, et l'historique de prospection reste attaché.
    "leadId" text references public.leads(id) on delete set null,
    owner_id uuid references auth.users(id) on delete set null,
    "createdAt" timestamptz not null default now(),
    "updatedAt" timestamptz not null default now()
);

create index if not exists idx_calls_owner on public.calls(owner_id);
create index if not exists idx_calls_date on public.calls(date);
create index if not exists idx_calls_lead on public.calls("leadId");

-- -----------------------------------------------------------------------------
-- RLS : même règle que les leads — chacun ses appels, l'admin voit tout.
-- -----------------------------------------------------------------------------
alter table public.calls enable row level security;

drop policy if exists "calls_owner_access" on public.calls;
create policy "calls_owner_access" on public.calls
  for all to authenticated
  using (public.is_active() and (owner_id = auth.uid() or public.is_admin()))
  with check (public.is_active() and (owner_id = auth.uid() or public.is_admin()));

-- Rattrapage : les appels importés sans propriétaire reviennent au premier admin.
update public.calls
   set owner_id = (select id from public.profiles where role = 'admin' order by created_at limit 1)
 where owner_id is null
   and exists (select 1 from public.profiles where role = 'admin');

-- Contrôle : volume d'appels et taux de rendez-vous par compte.
select
  coalesce(p.full_name, p.email, 'non attribué') as appelant,
  count(*) as appels,
  count(*) filter (where c.meeting) as rendez_vous
from public.calls c
left join public.profiles p on p.id = c.owner_id
group by 1
order by 2 desc;
