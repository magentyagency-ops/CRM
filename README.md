# Nira CRM

Plateforme locale de pilotage commercial : tableau de bord, pipeline de leads par niveau
d'avancement et agenda. Même stack et même langage visuel que PerfectServe Mission Control
(TypeScript, Vite, Express, thèmes verre dépoli).

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvrir ensuite : <http://127.0.0.1:5173/>

Le client tourne sur Vite (port 5173) et l'API Express sur le port 3002. Toutes les données
sont enregistrées localement dans `data/crm.json` — rien n'est envoyé à l'extérieur.

## Les trois espaces

### Tableau de bord

- Résumé du pipeline en une phrase : opportunités ouvertes, valeur totale, valeur pondérée
  par la probabilité, priorités hautes, clôtures dépassées.
- Quatre indicateurs : leads ouverts, pipeline, taux de closing, chiffre gagné.
- Répartition de la valeur par étape.
- Leads à relancer (priorité puis ancienneté de la dernière activité) et prochains rendez-vous.

### Pipeline

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

## API locale

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/api/state` | Thème, leads et rendez-vous |
| `PUT` | `/api/theme` | Enregistrer le thème |
| `POST` / `PATCH` / `DELETE` | `/api/leads[/:id]` | Gérer les leads |
| `POST` | `/api/leads/:id/activities` | Ajouter une entrée d'historique |
| `POST` / `PATCH` / `DELETE` | `/api/events[/:id]` | Gérer les rendez-vous |

Les entrées sont validées avec Zod ; l'écriture du fichier est atomique (fichier temporaire
puis renommage) et sérialisée pour éviter toute corruption.

## Vérifier la version de production

```bash
npm run build
```
