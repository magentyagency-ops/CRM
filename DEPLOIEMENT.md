# Mise en service des comptes d'équipe

Trois étapes : la base, la clé serveur, puis le premier compte admin.

## 1. Appliquer la migration SQL

Dans Supabase → **SQL Editor**, exécuter le contenu de
[`supabase/002-auth-multi-tenant.sql`](supabase/002-auth-multi-tenant.sql).

Ce script :

- crée la table `profiles` (un profil par compte : nom, rôle, activation, thème) ;
- ajoute `owner_id` sur `leads` et `events` ;
- **remplace les politiques d'accès anonyme** par un cloisonnement par compte :
  un commercial ne lit et n'écrit que ses propres leads, rendez-vous et activités,
  un administrateur accède à tout ;
- crée le déclencheur qui fabrique le profil à chaque inscription. Le rôle n'est
  jamais lu depuis les métadonnées d'inscription : personne ne peut se déclarer
  administrateur en s'inscrivant.

Le script est idempotent : il peut être relancé sans risque.

> Tant que cette migration n'est pas passée, l'application affiche une erreur de
> chargement : la table `profiles` n'existe pas encore.

## 2. Déclarer la clé service côté Vercel

La création de comptes passe par la fonction serverless `api/admin/users.ts`,
seule détentrice de la clé `service_role`. Dans Vercel → **Settings → Environment
Variables**, ajouter pour les environnements Production et Preview :

| Variable | Valeur | Où la trouver |
| --- | --- | --- |
| `SUPABASE_URL` | l'URL du projet | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé `service_role` | Supabase → Settings → API |
| `VITE_SUPABASE_URL` | la même URL | idem |
| `VITE_SUPABASE_ANON_KEY` | la clé `anon` | idem |

⚠️ La clé `service_role` contourne toutes les règles de sécurité. Elle ne doit
jamais être préfixée `VITE_` : ce préfixe l'embarquerait dans le JavaScript
envoyé au navigateur. Elle reste uniquement côté fonction serverless.

Sans cette variable, l'application fonctionne normalement mais l'onglet
**Réglages** affiche « Administration indisponible ».

## 3. Créer le compte administrateur

1. Dans Supabase → **Authentication → Providers → Email**, laisser les
   inscriptions ouvertes le temps de cette étape.
2. Créer le compte administrateur, au choix :
   - Supabase → **Authentication → Users → Add user** (cocher « Auto Confirm ») ;
   - ou une inscription depuis l'application.
3. Le premier compte créé — ou celui portant l'email défini par la fonction
   `bootstrap_admin_email()` dans la migration, aujourd'hui `clarence@nira-ia.com` —
   devient automatiquement **administrateur** et **hérite de tous les leads et
   rendez-vous déjà importés**.
4. Refermer ensuite les inscriptions publiques (**Authentication → Providers →
   Email → Allow new users to sign up : off**). Les comptes suivants se créent
   depuis l'onglet **Réglages** de l'application.

Vérification : se connecter, ouvrir **Réglages**, la liste doit contenir un seul
compte marqué « Admin », et le pipeline doit afficher les 10 deals importés.

## Ce que voit chaque rôle

| | Commercial | Administrateur |
| --- | --- | --- |
| Tableau de bord, pipeline, leads, agenda | ses données uniquement | toutes les données |
| Filtre par compte dans le pipeline | — | oui, un ou plusieurs comptes |
| Propriétaire d'un lead affiché sur les cartes | — | oui |
| Réattribuer un lead à un autre compte | — | oui (champ « Responsable ») |
| Onglet Réglages (créer, modifier, désactiver, supprimer un compte) | — | oui |

Le cloisonnement est appliqué par PostgreSQL (Row Level Security), pas par
l'interface : même en manipulant le client, un commercial ne peut pas lire les
deals d'un collègue.

## Gestion des comptes au quotidien

Onglet **Réglages** :

- **Nouveau compte** — email, mot de passe initial, rôle. Le compte est actif
  immédiatement, sans email de confirmation à cliquer.
- **Gérer** — renommer, changer le rôle, réinitialiser le mot de passe, ou
  désactiver l'accès (la connexion est alors refusée, les données sont conservées).
- **Supprimer** — le compte est supprimé et ses deals et rendez-vous sont
  transférés à ton compte administrateur, pour qu'aucune donnée commerciale ne
  disparaisse.
- **Voir ses deals** — bascule sur le pipeline filtré sur ce compte.

Deux garde-fous côté serveur : un administrateur ne peut ni retirer ses propres
droits, ni supprimer son propre compte.

## Développement local

```bash
npm install
npm run dev          # client Vite seul
```

Pour tester aussi les fonctions serverless d'administration en local :

```bash
npx vercel dev
```

en ayant renseigné `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans `.env`
(ce fichier est ignoré par Git).
