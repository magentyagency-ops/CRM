-- =============================================================================
-- NIRA CRM — Type d'offre proposée au prospect
-- =============================================================================
-- À exécuter dans l'éditeur SQL de Supabase.
-- Idempotent : peut être rejoué sans risque.
--
-- Distingue ce qui est proposé : un logiciel ou un audit. La chaîne vide
-- correspond aux leads existants, dont l'offre n'a pas encore été renseignée.
-- =============================================================================

alter table public.leads
  add column if not exists offer text not null default '';

alter table public.leads
  drop constraint if exists leads_offer_check;

alter table public.leads
  add constraint leads_offer_check check (offer in ('', 'logiciel', 'audit'));

create index if not exists idx_leads_offer on public.leads(offer);

-- Contrôle : répartition actuelle.
select coalesce(nullif(offer, ''), 'non renseigné') as offre, count(*) as leads
from public.leads
group by 1
order by 2 desc;
