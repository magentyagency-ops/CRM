-- =============================================================================
-- NIRA CRM — Étape « Démo » entre R1 et R2
-- =============================================================================
-- À exécuter dans l'éditeur SQL de Supabase, après 006-etapes-pipeline.sql.
-- Idempotent : peut être rejoué sans risque. Aucun lead n'est déplacé.
-- =============================================================================

alter table public.leads drop constraint if exists leads_stage_check;

alter table public.leads
  add constraint leads_stage_check
  check (stage in ('qualified', 'r1', 'demo', 'r2', 'negotiation', 'won', 'lost'));

-- Contrôle : répartition du pipeline.
select stage, count(*) as leads, sum(value) as montant
from public.leads
group by stage
order by array_position(array['qualified','r1','demo','r2','negotiation','won','lost'], stage);
