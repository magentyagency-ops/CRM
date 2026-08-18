-- =============================================================================
-- NIRA CRM — Réparation : profils manquants et deals orphelins
-- =============================================================================
-- À exécuter dans l'éditeur SQL de Supabase si un compte existe dans
-- Authentication → Users mais que la connexion échoue avec « Aucun profil
-- n'est associé à … ». C'est le cas notamment pour les comptes créés avant la
-- migration 002, pour lesquels le déclencheur n'existait pas encore.
--
-- Le script est idempotent : il peut être rejoué sans risque.
-- =============================================================================

-- 1. Créer le profil de chaque compte qui n'en a pas.
--    Le tout premier profil créé, ou celui portant l'email d'amorçage, est admin.
-- Le classement par ancienneté évite de promouvoir tous les comptes d'un coup :
-- la condition « aucun profil n'existe encore » est évaluée sur l'état d'avant
-- l'insertion, elle serait vraie pour toutes les lignes du même INSERT.
with sans_profil as (
  select
    u.id,
    coalesce(u.email, '') as email,
    coalesce(u.raw_user_meta_data ->> 'full_name', '') as full_name,
    row_number() over (order by u.created_at) as rang
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
)
insert into public.profiles (id, email, full_name, role)
select
  id,
  email,
  full_name,
  case
    when email = public.bootstrap_admin_email() then 'admin'
    when rang = 1 and not exists (select 1 from public.profiles) then 'admin'
    else 'user'
  end
from sans_profil;

-- 2. Rattacher les données importées avant la mise en place des comptes
--    au plus ancien administrateur.
update public.leads
   set owner_id = (select id from public.profiles where role = 'admin' order by created_at limit 1)
 where owner_id is null;

update public.events
   set owner_id = (select id from public.profiles where role = 'admin' order by created_at limit 1)
 where owner_id is null;

-- 3. Contrôle : doit afficher ton compte en 'admin' avec le nombre de deals.
select
  p.email,
  p.role,
  p.active,
  (select count(*) from public.leads l where l.owner_id = p.id) as deals
from public.profiles p
order by p.created_at;
