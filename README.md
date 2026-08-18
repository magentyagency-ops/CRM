# Nira CRM

Plateforme de pilotage commercial pour une équipe : tableau de bord, pipeline de leads par
niveau d'avancement et agenda. TypeScript et Vite côté client, Supabase (PostgreSQL, Auth,
RLS) pour les données et les comptes, Vercel pour l'hébergement et les fonctions
d'administration. Langage visuel repris de PerfectServe Mission Control (verre dépoli).

## Démarrer en local

```bash
npm install
npm run dev          # http://127.0.0.1:5180
```

Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env` (voir `.env.example`).
Pour tester aussi l'administration des comptes en local : `npx vercel dev`.

## Comptes et rôles

L'application est multi-comptes : chaque commercial ne voit que ses propres leads,
rendez-vous et statistiques, un administrateur voit et gère tout. Le cloisonnement
est appliqué par la Row Level Security de Supabase, et les comptes se créent depuis
l'onglet **Réglages**. La mise en service est décrite dans
[DEPLOIEMENT.md](DEPLOIEMENT.md).

## Les trois espaces

### Tableau de bord

- Résumé du pipeline en une phrase : opportunités ouvertes, valeur totale, valeur pondérée
  par la probabilité, priorités hautes, clôtures dépassées.
- Quatre indicateurs : leads ouverts, pipeline, taux de closing, chiffre gagné.
- Répartition de la valeur par étape.
- Leads à relancer (priorité puis ancienneté de la dernière activité) et prochains rendez-vous.

### Pipeline

- Filtre par compte (administrateur) : tous les deals, ceux d'un commercial, ou
  une sélection de plusieurs commerciaux à la fois.
- Six colonnes : Nouveau, Qualifié, Proposition, Négociation, Gagné, Perdu.
- Glisser-déposer d'une carte pour faire avancer un lead ; la probabilité est alignée sur
  l'étape et le changement est ajouté à l'historique du lead.
- Recherche instantanée sur le contact, la société, le responsable, la source et les tags.
- Clic sur une carte : panneau latéral avec fiche complète, étapes, rendez-vous liés et
  historique (notes, appels, emails, réunions).

### Leads

Vue tableau de la même base : filtre par étape, recherche, tri sur chaque colonne, et actions
rapides (planifier, modifier, supprimer).

### Agenda

- Trois modes : mois, semaine, liste.
- Clic sur un jour pour créer un créneau, glisser-déposer d'un rendez-vous pour le déplacer.
- Chaque rendez-vous peut être relié à un lead ; il apparaît alors dans sa fiche, et sa
  création est tracée dans son historique.

## Raccourcis

- `n` — nouveau lead
- `e` — nouveau rendez-vous
- `Échap` — fermer la modale ou le panneau latéral

## Architecture

| Élément | Rôle |
| --- | --- |
| `src/` | client TypeScript ; lit et écrit directement dans Supabase avec la clé publique |
| `supabase/schema.sql` | tables métier (leads, activités, rendez-vous) |
| `supabase/002-auth-multi-tenant.sql` | comptes, rôles, propriétaire des données et politiques RLS |
| `api/admin/users.ts` | fonction serverless Vercel : création et gestion des comptes (clé `service_role`) |
| `server/index.ts` | ancienne API Express sur fichier JSON, conservée pour référence, plus utilisée |

Les droits ne sont pas appliqués par l'interface mais par PostgreSQL : chaque requête du
navigateur est filtrée par la Row Level Security selon le compte connecté.

## Vérifier la version de production

```bash
npm run build
```
