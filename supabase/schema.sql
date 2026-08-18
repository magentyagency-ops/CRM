-- =============================================================================
-- NIRA CRM - Schema Supabase PostgreSQL
-- =============================================================================

-- 1. Table des Paramètres (Thème, etc.)
create table if not exists public.settings (
    id text primary key default 'general',
    theme text not null default 'light' check (theme in ('light', 'midnight', 'ocean', 'sunset')),
    updated_at timestamptz not null default now()
);

-- 2. Table des Leads
create table if not exists public.leads (
    id text primary key default gen_random_uuid()::text,
    contact text not null default 'Nouveau contact',
    company text not null default '',
    email text not null default '',
    phone text not null default '',
    role text not null default '',
    source text not null default 'Direct',
    owner text not null default '',
    stage text not null default 'new' check (stage in ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
    value numeric not null default 0,
    probability numeric not null default 10,
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
    "nextStep" text not null default '',
    "expectedCloseAt" text not null default '',
    tags jsonb not null default '[]'::jsonb,
    notes text not null default '',
    "createdAt" timestamptz not null default now(),
    "updatedAt" timestamptz not null default now()
);

-- 3. Table des Activités
create table if not exists public.activities (
    id text primary key default gen_random_uuid()::text,
    "leadId" text not null references public.leads(id) on delete cascade,
    kind text not null check (kind in ('note', 'call', 'email', 'meeting', 'stage')),
    text text not null,
    "createdAt" timestamptz not null default now()
);

-- 4. Table des Événements du Calendrier
create table if not exists public.events (
    id text primary key default gen_random_uuid()::text,
    title text not null default 'Rendez-vous',
    kind text not null default 'meeting' check (kind in ('call', 'meeting', 'demo', 'followup', 'internal')),
    start timestamptz not null default now(),
    "end" timestamptz not null default now(),
    "leadId" text references public.leads(id) on delete set null,
    location text not null default '',
    notes text not null default '',
    done boolean not null default false,
    "createdAt" timestamptz not null default now(),
    "updatedAt" timestamptz not null default now()
);

-- =============================================================================
-- Index pour optimiser les performances
-- =============================================================================
create index if not exists idx_activities_lead_id on public.activities("leadId");
create index if not exists idx_events_lead_id on public.events("leadId");
create index if not exists idx_leads_stage on public.leads(stage);

-- =============================================================================
-- Sécurité & RLS (Row Level Security)
-- On active RLS et on permet la lecture / écriture anonyme pour l'application CRM
-- =============================================================================
alter table public.settings enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.events enable row level security;

-- Politiques RLS pour l'accès anon
drop policy if exists "anon_settings_all" on public.settings;
create policy "anon_settings_all" on public.settings for all using (true) with check (true);

drop policy if exists "anon_leads_all" on public.leads;
create policy "anon_leads_all" on public.leads for all using (true) with check (true);

drop policy if exists "anon_activities_all" on public.activities;
create policy "anon_activities_all" on public.activities for all using (true) with check (true);

drop policy if exists "anon_events_all" on public.events;
create policy "anon_events_all" on public.events for all using (true) with check (true);

-- =============================================================================
-- Données Initiales (Settings & Leads existants)
-- =============================================================================
insert into public.settings (id, theme)
values ('general', 'light')
on conflict (id) do nothing;

-- Leads existants
insert into public.leads (id, contact, company, email, phone, role, source, owner, stage, value, probability, priority, "nextStep", "expectedCloseAt", tags, notes, "createdAt", "updatedAt")
values
  ('fb72a876-7843-4dcf-b965-f68c5a56137d', 'Partouche', 'Arnaud', '', '', '', 'Direct', '', 'new', 0, 80, 'medium', '', '', '[]'::jsonb, '', '2026-08-18T00:07:54.395Z', '2026-08-18T00:07:54.395Z'),
  ('5a29b1fc-6dcb-4001-8975-b60b24753261', 'Damian', 'Mercer', '', '', '', 'Direct', '', 'lost', 3300, 0, 'medium', '', '', '[]'::jsonb, '', '2026-08-18T00:03:38.598Z', '2026-08-18T00:03:38.598Z'),
  ('d59fe573-dbf2-4959-ba4e-e9d33a163bc2', 'Somoene', 'Tessi', '', '', '', 'Direct', '', 'lost', 2100, 0, 'medium', '', '', '[]'::jsonb, '', '2026-08-18T00:03:12.643Z', '2026-08-18T00:03:12.643Z'),
  ('a7bf1ab9-2e92-417f-ab45-b47c1087e9f1', 'Docteur', 'Liliale', '', '', '', 'Direct', '', 'negotiation', 12000, 80, 'medium', '', '', '[]'::jsonb, '', '2026-08-18T00:01:54.994Z', '2026-08-18T00:01:54.994Z'),
  ('bc347166-b965-4197-ba7f-885ef3331b44', 'Olivier', 'Certus', '', '', '', 'Direct', '', 'negotiation', 30000, 80, 'high', '', '', '[]'::jsonb, '', '2026-08-18T00:01:22.005Z', '2026-08-18T00:01:22.005Z'),
  ('327914ef-1474-40f6-999e-94b9b8d353ba', 'Fabrice', '+IMMO', '', '', '', 'Direct', '', 'won', 4300, 100, 'medium', '', '', '[]'::jsonb, '', '2026-08-18T00:00:18.320Z', '2026-08-18T00:00:18.320Z'),
  ('75a9cecd-f7f3-4303-9610-38536f137e9d', 'Adil', 'GSS', '', '', '', 'Direct', '', 'won', 4300, 100, 'medium', '', '', '[]'::jsonb, '', '2026-08-17T23:58:49.943Z', '2026-08-17T23:58:49.943Z'),
  ('ffb99896-597b-4994-a188-aff3a829fa3f', 'Olivier', 'Certus', '', '', '', 'Direct', '', 'won', 2000, 100, 'medium', '', '', '[]'::jsonb, '', '2026-08-17T23:58:05.133Z', '2026-08-17T23:58:07.509Z'),
  ('a6ffba0c-249a-447d-a5d8-c5bc9cdc6f0c', 'Guillaume', 'TAC', '', '', '', 'Direct', '', 'won', 7600, 100, 'medium', '', '', '[]'::jsonb, '', '2026-08-17T23:56:22.310Z', '2026-08-17T23:56:53.932Z'),
  ('7f1ef5d6-1584-49c4-885a-1d850bd6ac6f', 'Arnaud', 'Pathé Rouen', '', '', '', 'Direct', '', 'won', 2300, 100, 'medium', '', '', '[]'::jsonb, '', '2026-08-17T23:54:16.387Z', '2026-08-17T23:54:16.387Z')
on conflict (id) do nothing;

-- Activités initiales
insert into public.activities (id, "leadId", kind, text, "createdAt")
values
  ('758e3e39-4100-42ef-a552-7b6e982d140c', 'fb72a876-7843-4dcf-b965-f68c5a56137d', 'stage', 'Lead créé.', '2026-08-18T00:07:54.395Z'),
  ('8364d4b0-a6ae-4cd1-b668-51a7f31a702e', '5a29b1fc-6dcb-4001-8975-b60b24753261', 'stage', 'Lead créé.', '2026-08-18T00:03:38.598Z'),
  ('3c9afe58-5282-4dbd-800c-1ee7003aa30d', 'd59fe573-dbf2-4959-ba4e-e9d33a163bc2', 'stage', 'Lead créé.', '2026-08-18T00:03:12.643Z'),
  ('59581506-ce4d-4f7b-af66-52fbb7aca4c1', 'a7bf1ab9-2e92-417f-ab45-b47c1087e9f1', 'stage', 'Lead créé.', '2026-08-18T00:01:54.994Z'),
  ('e60c6146-0e36-4048-b48c-8b5d7471de48', 'bc347166-b965-4197-ba7f-885ef3331b44', 'stage', 'Lead créé.', '2026-08-18T00:01:22.005Z'),
  ('0d667e00-8ce4-4b9e-a194-566db3cc6edb', '327914ef-1474-40f6-999e-94b9b8d353ba', 'stage', 'Lead créé.', '2026-08-18T00:00:18.320Z'),
  ('aee1ec84-1717-44aa-94a8-cc6bf6ee08ab', '75a9cecd-f7f3-4303-9610-38536f137e9d', 'stage', 'Lead créé.', '2026-08-17T23:58:49.943Z'),
  ('5bfb9e7b-1faf-4eb8-9877-ab2d3f670947', 'ffb99896-597b-4994-a188-aff3a829fa3f', 'stage', 'Étape : new → won.', '2026-08-17T23:58:07.509Z'),
  ('488f7add-75d8-429e-8de1-962ba30dd591', 'ffb99896-597b-4994-a188-aff3a829fa3f', 'stage', 'Lead créé.', '2026-08-17T23:58:05.133Z'),
  ('6d419241-b9c5-4ccc-bdde-09c204483e48', 'a6ffba0c-249a-447d-a5d8-c5bc9cdc6f0c', 'stage', 'Lead créé.', '2026-08-17T23:56:22.310Z'),
  ('77b3b9ff-a2f5-43d0-878e-43f1237a1f33', '7f1ef5d6-1584-49c4-885a-1d850bd6ac6f', 'stage', 'Lead créé.', '2026-08-17T23:54:16.387Z')
on conflict (id) do nothing;
