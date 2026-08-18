-- =============================================================================
-- NIRA CRM — Comptes, rôles et cloisonnement des données
-- =============================================================================
-- À exécuter dans l'éditeur SQL de Supabase APRÈS schema.sql.
-- Le script est idempotent : il peut être rejoué sans risque.
--
-- Modèle retenu :
--   * chaque lead et chaque rendez-vous appartient à un compte (owner_id) ;
--   * un compte « user » ne voit et ne modifie que ses propres données ;
--   * un compte « admin » voit et modifie tout, et gère les comptes ;
--   * le premier compte créé — ou celui portant l'email défini ci-dessous —
--     devient admin et hérite de toutes les données déjà importées.
-- =============================================================================

-- Email promu admin automatiquement à l'inscription. À adapter si besoin.
create or replace function public.bootstrap_admin_email()
returns text language sql immutable as $$ select 'clarence@nira-ia.com'::text $$;

-- -----------------------------------------------------------------------------
-- 1. Profils (une ligne par compte, adossée à auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    full_name text not null default '',
    role text not null default 'user' check (role in ('admin', 'user')),
    active boolean not null default true,
    theme text not null default 'light' check (theme in ('light', 'midnight', 'ocean', 'sunset')),
    created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Propriétaire des données
-- -----------------------------------------------------------------------------
alter table public.leads add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.events add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists idx_leads_owner on public.leads(owner_id);
create index if not exists idx_events_owner on public.events(owner_id);

-- -----------------------------------------------------------------------------
-- 3. Fonctions d'autorisation
-- -----------------------------------------------------------------------------
-- security definer : la fonction lit profiles sans repasser par la RLS,
-- ce qui évite une récursion infinie dans les politiques ci-dessous.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active
  );
$$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active);
$$;

-- -----------------------------------------------------------------------------
-- 4. Création automatique du profil à l'inscription
-- -----------------------------------------------------------------------------
-- Le rôle n'est JAMAIS lu depuis les métadonnées de l'utilisateur : un compte ne
-- peut donc pas se déclarer admin lui-même à l'inscription. Seule la fonction
-- serverless d'administration (clé service_role) peut promouvoir un compte.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  select case
    when (select count(*) from public.profiles) = 0 then 'admin'
    when new.email = public.bootstrap_admin_email() then 'admin'
    else 'user'
  end into assigned_role;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    assigned_role
  )
  on conflict (id) do nothing;

  -- Le premier admin récupère les données importées avant la mise en place des comptes.
  if assigned_role = 'admin' then
    update public.leads set owner_id = new.id where owner_id is null;
    update public.events set owner_id = new.id where owner_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rattrapage : si un admin existe déjà, les données orphelines lui reviennent.
update public.leads
   set owner_id = (select id from public.profiles where role = 'admin' order by created_at limit 1)
 where owner_id is null
   and exists (select 1 from public.profiles where role = 'admin');

update public.events
   set owner_id = (select id from public.profiles where role = 'admin' order by created_at limit 1)
 where owner_id is null
   and exists (select 1 from public.profiles where role = 'admin');

-- -----------------------------------------------------------------------------
-- 5. RLS — on remplace l'accès anonyme total par un accès par compte
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.events enable row level security;
alter table public.settings enable row level security;

-- Anciennes politiques ouvertes (accès anonyme) : supprimées.
drop policy if exists "anon_settings_all" on public.settings;
drop policy if exists "anon_leads_all" on public.leads;
drop policy if exists "anon_activities_all" on public.activities;
drop policy if exists "anon_events_all" on public.events;

-- Profils : chacun lit le sien, l'admin lit et gère tout.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Un compte peut modifier son nom et son thème, jamais son rôle ni son activation :
-- le garde-fou est un trigger, une politique RLS qui relirait profiles récurserait.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() est nul pour la clé service_role et pour l'éditeur SQL : ces deux
  -- chemins sont déjà réservés à l'administration et ne sont pas bridés ici.
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Leads : les siens, ou tout pour l'admin.
drop policy if exists "leads_owner_access" on public.leads;
create policy "leads_owner_access" on public.leads
  for all to authenticated
  using (public.is_active() and (owner_id = auth.uid() or public.is_admin()))
  with check (public.is_active() and (owner_id = auth.uid() or public.is_admin()));

-- Rendez-vous : même règle.
drop policy if exists "events_owner_access" on public.events;
create policy "events_owner_access" on public.events
  for all to authenticated
  using (public.is_active() and (owner_id = auth.uid() or public.is_admin()))
  with check (public.is_active() and (owner_id = auth.uid() or public.is_admin()));

-- Activités : héritent des droits du lead parent.
drop policy if exists "activities_owner_access" on public.activities;
create policy "activities_owner_access" on public.activities
  for all to authenticated
  using (
    public.is_active() and exists (
      select 1 from public.leads l
      where l.id = activities."leadId" and (l.owner_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    public.is_active() and exists (
      select 1 from public.leads l
      where l.id = activities."leadId" and (l.owner_id = auth.uid() or public.is_admin())
    )
  );

-- Table settings : conservée pour l'historique, plus utilisée par l'application
-- (le thème est désormais stocké par compte dans profiles.theme).
drop policy if exists "settings_admin_only" on public.settings;
create policy "settings_admin_only" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. Statistiques par compte (utilisées par l'écran d'administration)
-- -----------------------------------------------------------------------------
create or replace function public.member_stats()
returns table (
  owner_id uuid,
  leads_count bigint,
  open_count bigint,
  open_value numeric,
  won_value numeric,
  last_activity timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.owner_id,
    count(*) as leads_count,
    count(*) filter (where l.stage not in ('won', 'lost')) as open_count,
    coalesce(sum(l.value) filter (where l.stage not in ('won', 'lost')), 0) as open_value,
    coalesce(sum(l.value) filter (where l.stage = 'won'), 0) as won_value,
    max(l."updatedAt") as last_activity
  from public.leads l
  where public.is_admin() or l.owner_id = auth.uid()
  group by l.owner_id;
$$;

revoke all on function public.member_stats() from anon;
grant execute on function public.member_stats() to authenticated;
