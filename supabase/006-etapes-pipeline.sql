-- =============================================================================
-- NIRA CRM — Étapes du pipeline : Qualifié, R1, R2, Négociation, Gagné, Perdu
-- =============================================================================
-- À exécuter dans l'éditeur SQL de Supabase.
-- Idempotent : peut être rejoué sans risque.
--
-- Le cycle de vente se raconte désormais par les rendez-vous obtenus. L'étape
-- « Nouveau » disparaît — un lead entre au pipeline parce qu'il est qualifié —
-- et « Proposition » devient « R1 », le premier rendez-vous.
--
--   new        -> qualified
--   proposal   -> r1
--
-- Les autres étapes sont inchangées. Aucun lead n'est supprimé ni déplacé
-- au-delà de cette correspondance.
-- =============================================================================

-- 1. La contrainte doit tomber avant la reprise des données : les anciennes et
--    les nouvelles valeurs ne peuvent pas cohabiter sous la même règle.
alter table public.leads drop constraint if exists leads_stage_check;

update public.leads set stage = 'qualified' where stage = 'new';
update public.leads set stage = 'r1' where stage = 'proposal';

alter table public.leads alter column stage set default 'qualified';

alter table public.leads
  add constraint leads_stage_check
  check (stage in ('qualified', 'r1', 'r2', 'negotiation', 'won', 'lost'));

-- 2. Les activités gardent la trace des anciens libellés : c'est un historique,
--    il n'est pas réécrit.

-- Contrôle : répartition du pipeline après reprise.
select stage, count(*) as leads, sum(value) as montant
from public.leads
group by stage
order by array_position(array['qualified','r1','r2','negotiation','won','lost'], stage);
