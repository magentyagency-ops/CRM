import type { Brief, GenerateStep, StudioInput } from '../../src/proposals/model.js'

/**
 * Schémas de sortie et consignes du modèle pour chaque étape de génération.
 *
 * Les schémas sont en mode strict : chaque champ est obligatoire (une chaîne
 * vide tient lieu de « rien »), ce qui garantit aux gabarits un contenu complet.
 */

/* ------------------------------------------------------- schémas JSON */

type Schema = Record<string, unknown>

const str = (description?: string): Schema => ({ type: 'string', ...(description ? { description } : {}) })
const num = (description?: string): Schema => ({ type: 'number', ...(description ? { description } : {}) })
const arr = (items: Schema, description?: string): Schema => ({
  type: 'array',
  items,
  ...(description ? { description } : {}),
})
const obj = (properties: Record<string, Schema>, description?: string): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
  ...(description ? { description } : {}),
})

const titleDetail = obj({ title: str('3 à 6 mots'), detail: str('Une phrase, 22 mots maximum') })

const briefSchema = obj({
  projectTitle: str('Titre du projet orienté bénéfice client, 4 à 8 mots, sans le nom du client'),
  objet: str("Objet de la proposition, une phrase (ex. « Audit des processus commerciaux et feuille de route d'automatisation »)"),
  clientName: str('Nom commercial du client'),
  sector: str("Secteur d'activité, précis"),
  context: str('Situation du client en 2 à 3 phrases factuelles'),
  painPoints: arr(
    obj({
      title: str('Le problème, 3 à 7 mots'),
      detail: str('Conséquence concrète pour le client, une phrase'),
      evidence: str("Ce qui l'atteste dans les échanges : citation courte ou fait précis ; vide si déduit"),
    }),
    '3 à 5 douleurs réellement exprimées, de la plus coûteuse à la moins coûteuse',
  ),
  goals: arr(str(), '3 à 5 objectifs du client, formulés avec ses mots'),
  keyFigures: arr(
    obj({ value: str('Chiffre court : « 10k », « 3 h/jour », « 250 »'), label: str(), context: str() }),
    'Chiffres cités par le client ou calculés explicitement à partir de ses chiffres. Jamais inventés. Liste vide si aucun.',
  ),
  verbatims: arr(
    obj({ quote: str('Citation exacte, 25 mots maximum'), speaker: str('Nom ou fonction de la personne') }),
    'Phrases marquantes prononcées par le client, recopiées telles quelles. Liste vide sans transcription.',
  ),
  stakeholders: arr(obj({ name: str(), role: str(), concern: str('Ce qui compte pour cette personne') })),
  objections: arr(obj({ objection: str(), answer: str('Réponse à intégrer dans les documents') })),
  solution: obj({
    name: str('Nom de la solution ou de la mission, 2 à 5 mots, évocateur et propre au client'),
    pitch: str('La promesse en une phrase'),
    pillars: arr(titleDetail, '4 piliers de la solution'),
  }),
  tools: arr(
    obj({
      name: str("Outil réel : n8n, Make, HubSpot, API OpenAI, Airtable, l'outil métier du client…"),
      category: str(),
      purpose: str('Son rôle dans le projet'),
      why: str('Pourquoi lui, pour ce client'),
    }),
    'Outils proposés ou recommandés. Liste vide si aucun outil ne fait partie de la proposition.',
  ),
  deliverables: arr(obj({ title: str(), items: arr(str()) }), '3 à 4 groupes de livrables'),
  phases: arr(
    obj({
      name: str('1 à 3 mots'),
      duration: str('« 1 semaine », « 2 à 3 semaines »'),
      objective: str(),
      activities: arr(str(), '2 à 4 activités'),
    }),
    '3 à 4 phases',
  ),
  expectedResults: arr(
    obj({
      metric: str('Ce qui s\'améliore, 2 à 4 mots'),
      value: str('Ordre de grandeur prudent ou symbole (↗, ↘) si aucun chiffre défendable'),
      detail: str(),
    }),
    '4 résultats attendus',
  ),
  pricing: obj({
    lines: arr(
      obj({
        label: str('Intitulé de la prestation'),
        description: str('Ce que couvre la ligne, une phrase'),
        quantity: str('« 1 forfait », « 3 jours »'),
        unitPrice: num('Prix unitaire TTC en euros'),
        total: num('Total TTC de la ligne en euros'),
      }),
      '1 à 4 lignes',
    ),
    paymentTerms: arr(str(), "Échéancier de paiement, 2 à 3 points"),
    validityDays: num("Durée de validité de l'offre en jours"),
  }),
  typography: {
    type: 'string',
    enum: ['moderne', 'editorial', 'tech', 'classique'],
    description:
      "Style typographique adapté au client : moderne (services, PME dynamiques), editorial (immobilier, luxe, conseil, culture), tech (logiciel, industrie, data), classique (juridique, finance, santé, institutions)",
  },
  missingInfo: arr(str(), 'Points que le commercial doit vérifier avant envoi (informations manquantes, hypothèses prises)'),
})

const deckSchema = obj({
  concept: str('La direction artistique choisie pour ce client, en 2 phrases : intention, ambiance, fil visuel'),
  css: str('Ajustements CSS communs aux slides, classes préfixées d- (sans balise <style>) ; peut être court'),
  slides: arr(
    obj({
      title: str('Titre court de la slide, pour la navigation'),
      html: str("Contenu HTML de la slide, sans la balise <section> qui l'entoure"),
    }),
    '8 à 15 slides',
  ),
})

const proposalSchema = obj({
  title: str('Titre de la proposition, orienté bénéfice'),
  objet: str(),
  introduction: str('Paragraphe d’ouverture adressé au client, 3 à 4 phrases'),
  context: obj({
    paragraphs: arr(str(), '2 paragraphes : le constat, puis l’ambition'),
    highlights: arr(obj({ value: str(), label: str() }), '0 à 3 chiffres clés réellement cités'),
  }),
  objectives: arr(titleDetail, '3 à 4 objectifs'),
  solution: obj({ intro: str(), blocks: arr(obj({ title: str(), text: str('2 à 3 phrases') }), '4 blocs') }),
  methodology: arr(titleDetail, '3 à 5 principes de méthode'),
  deliverables: arr(obj({ title: str(), items: arr(str()) }), '3 à 4 groupes'),
  planning: arr(obj({ phase: str(), duration: str(), detail: str() }), '3 à 4 phases'),
  whyUs: arr(titleDetail, '3 raisons propres à ce projet'),
  conditions: arr(str(), 'Conditions complémentaires : confidentialité, prérequis côté client, propriété des livrables…'),
})

const techdocSchema = obj({
  title: str(),
  summary: str('Résumé en 3 à 4 phrases'),
  scope: arr(str(), 'Périmètre couvert, 4 à 6 points'),
  architecture: obj({
    overview: str('Vue d’ensemble en 3 phrases'),
    layers: arr(
      obj({
        name: str('Ex. « Sources de données », « Orchestration », « Intelligence », « Restitution »'),
        components: arr(obj({ name: str(), role: str('12 mots maximum'), tech: str() }), '1 à 4 composants'),
      }),
      '3 à 4 couches, de la source vers l’utilisateur',
    ),
  }),
  flows: arr(
    obj({ step: str('Nom du flux'), from: str(), to: str(), data: str(), frequency: str('« temps réel », « quotidien »…') }),
    '3 à 6 flux de données',
  ),
  tools: arr(
    obj({
      name: str(),
      category: str(),
      purpose: str(),
      features: arr(str(), '3 à 5 fonctionnalités utilisées'),
      integration: str('Comment il est connecté au reste'),
      hosting: str('Hébergement et localisation des données'),
      licence: str('Modèle de licence ou de coût, ou « inclus »'),
    }),
  ),
  dataAndSecurity: arr(titleDetail, 'RGPD, accès, chiffrement, journalisation, hébergement : 4 à 6 points'),
  deployment: arr(obj({ step: str(), detail: str() }), '4 à 6 étapes de mise en service'),
  operations: arr(titleDetail, 'Supervision, maintenance, support, évolutions : 3 à 4 points'),
  prerequisites: arr(str(), 'Ce que le client doit fournir'),
  risks: arr(obj({ risk: str(), mitigation: str() }), '3 à 4 risques'),
})

export const SCHEMAS: Record<GenerateStep, Schema> = {
  brief: briefSchema,
  deck: deckSchema,
  proposal: proposalSchema,
  techdoc: techdocSchema,
}

/* ------------------------------------------------------------ consignes */

const NIRA = `Tu travailles pour Nira, agence française spécialisée en intelligence artificielle et en automatisation, basée à Rouen.
Nira vend principalement :
- des AUDITS : diagnostic des processus du client, repérage des tâches répétitives et des pertes de temps, opportunités d'IA et d'automatisation classées par impact et effort, recommandations d'outils, feuille de route chiffrée ;
- des LOGICIELS sur mesure : automatisations, agents IA, intégrations entre outils, outils métiers, mis en service et maintenus par Nira.`

const STYLE = `Règles d'écriture, non négociables :
- Français impeccable. Vouvoiement du client.
- Tout doit venir du client : ses mots, ses outils, ses chiffres, ses équipes, ses enjeux. Une phrase qui pourrait figurer telle quelle chez un autre client est à réécrire.
- N'invente JAMAIS un chiffre, un nom de personne, un outil utilisé par le client ou un fait. Si un chiffre manque, formule qualitativement et signale-le dans les points à vérifier.
- Bannis le jargon creux : « solution innovante », « synergie », « dans un monde en constante évolution », « booster », « révolutionner », « clé en main » sans précision.
- Phrases courtes, concrètes, orientées résultat. Respecte strictement les longueurs indiquées dans le schéma : la mise en page en dépend.`

function saleLabel(input: StudioInput): string {
  if (input.sale === 'audit') return 'un AUDIT'
  if (input.sale === 'logiciel') return 'un LOGICIEL sur mesure'
  return 'un AUDIT suivi de la réalisation d’un LOGICIEL sur mesure'
}

function dossier(input: StudioInput, withTranscript: boolean, website: string): string {
  const b = input.billing
  return [
    `# Client\n${input.company}${input.contact ? ` — interlocuteur : ${input.contact}${input.contactRole ? ` (${input.contactRole})` : ''}` : ''}`,
    b.legalName || b.address ? `Raison sociale : ${b.legalName || input.company}${b.address ? `, ${b.address} ${b.postalCity}` : ''}` : '',
    `# Ce que Nira vend\n${saleLabel(input)}.${input.offerDescription ? `\nPrécisions du commercial : ${input.offerDescription}` : ''}`,
    input.price > 0
      ? `# Prix\nMontant total : ${input.price} € TTC (TVA non applicable). Les lignes de prix doivent totaliser EXACTEMENT ce montant.`
      : `# Prix\nNon fixé par le commercial : propose un prix réaliste pour le marché français des PME, et signale-le dans les points à vérifier.`,
    b.paymentTerms ? `# Conditions de paiement imposées\n${b.paymentTerms}` : '',
    input.specialRequest ? `# Demande particulière du commercial (prioritaire)\n${input.specialRequest}` : '',
    input.leadNotes ? `# Notes et historique dans le CRM\n${input.leadNotes}` : '',
    website ? `# Extrait du site web du client\n${website}` : '',
    withTranscript && input.transcript
      ? `# Transcription des rendez-vous (R1 / démo)\n${input.transcript}`
      : withTranscript
        ? '# Transcription des rendez-vous\nAucune transcription fournie : appuie-toi sur les notes, sans inventer.'
        : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

const briefJson = (brief: Brief): string => `# Analyse validée (source de vérité pour le périmètre, les outils, les phases et les prix)\n${JSON.stringify(brief)}`

export interface StepPrompt {
  instructions: string
  input: string
  effort: 'low' | 'medium' | 'high'
}

export function buildPrompt(step: GenerateStep, input: StudioInput, brief: Brief | null, website: string): StepPrompt {
  if (step === 'brief') {
    return {
      effort: 'medium',
      instructions: `${NIRA}

Ta mission : analyser les échanges avec un prospect pour préparer sa présentation commerciale et sa proposition. Cette analyse alimente ensuite tous les documents : elle doit être exacte, précise et exploitable.

Méthode :
1. Lis tout le dossier. Repère ce que le client a réellement dit : douleurs, chiffres, outils actuels, équipes, contraintes, objections, critères de décision.
2. Construis la solution à partir de ces douleurs, en cohérence avec ce que Nira vend ici (${saleLabel(input)}).
   - Pour un audit : phases type cadrage, immersion et entretiens, analyse, restitution ; livrables type cartographie des processus, matrice des opportunités impact/effort, recommandations d'outils, feuille de route chiffrée, estimation du retour sur investissement — à adapter au client.
   - Pour un logiciel : conception, développement, intégration aux outils existants, recette, mise en service, formation, maintenance — à adapter au client.
3. Le prix : respecte le montant du commercial à l'euro près ; répartis-le en lignes cohérentes avec les phases.
4. Applique en priorité la demande particulière du commercial.

${STYLE}`,
      input: dossier(input, true, website),
    }
  }

  if (step === 'deck') {
    return {
      effort: 'medium',
      instructions: `${NIRA}

Tu es à la fois directeur de la stratégie commerciale et directeur artistique dans une agence de design de premier plan. Tu conçois de A à Z la présentation projetée lors du R2 avec ce prospect : le récit, la structure ET le design de chaque slide, en HTML et CSS.

# 1. Le récit : une structure propre à CE rendez-vous
Il n'existe aucun plan type. Avant d'écrire, demande-toi ce qui fera signer CE client, puis construis le récit qui y mène :
- un dirigeant méfiant appelle des preuves, du concret, une démarche réversible ;
- plusieurs décideurs appellent une slide par enjeu ou par interlocuteur ;
- une démo réussie appelle son récapitulatif et le « et maintenant » ;
- un client qui chiffre ses pertes appelle un calcul d'impact visualisé ;
- un process complexe appelle un schéma avant / après ;
- un client pressé appelle une présentation courte et directe.
Le nombre de slides (8 à 15), leur ordre et leur nature découlent de cette réflexion. Évite la trame « constat → problèmes → solution → résultats → planning → offre » si elle n'est pas la meilleure ici. Une slide = une idée.
Obligatoire : une ouverture forte avec le logo du client, une slide d'offre avec le prix, une conclusion qui déclenche la décision.

# 2. La direction artistique : unique pour ce client
Invente une direction artistique adaptée à son secteur et à sa personnalité (un industriel, une maison de luxe, un cabinet d'avocats et une start-up ne se présentent pas pareil), dans ses couleurs. Niveau attendu : agence haut de gamme, type Pentagram ou Apple keynote.
- Beaucoup d'air : marges d'au moins 96 px, des slides presque vides où un seul chiffre ou une seule phrase occupe l'espace, une hiérarchie typographique très marquée (titres de 64 à 140 px, texte courant de 22 à 28 px, jamais moins de 18 px).
- Variété : alterne fonds clairs, aplats pleine page dans la couleur du client, fonds sombres pour les ruptures, compositions asymétriques, grilles éditoriales, grands chiffres, citations immenses, cartes, frises.
- Visuels : dessine en SVG inline des schémas de flux, des architectures, des comparaisons avant / après, des graphiques simples à partir des chiffres réels, des formes graphiques, des pictogrammes au trait. Aucune image externe.
- Interdit : les slides « liste à puces », le texte serré, les dégradés criards, plus de 45 mots sur une slide (hors schéma), les emojis.
- Un fil visuel relie les slides (un motif, une trame, un repère de chapitre, un traitement des numéros).

# 3. La bibliothèque de composants
Tu ne vois pas le rendu : ne dessine jamais toi-même des traits, flèches ou cadres positionnés en coordonnées, ils tombent de travers. Compose tes slides avec ces composants, finis au pixel près et déjà aux couleurs du client. Tu peux les combiner librement, les imbriquer, ajuster espacements et tailles via ton CSS (style="..." ou classes d-), et ajouter des SVG simples (pictogrammes au trait, graphiques).

Chaque slide commence par <div class="k-slide FOND [k-center|k-end|k-between]"> qui remplit la toile (marges 96 × 112 px, colonne flex avec gap 40 px).
- FOND : k-bg-light (blanc), k-bg-tint (teinté), k-bg-soft, k-bg-brand (aplat couleur client, texte blanc), k-bg-dark (sombre profond). Sur k-bg-brand et k-bg-dark, les textes et composants passent en blanc d'eux-mêmes.
- Mise en page : k-grid-2, k-grid-3, k-split (5/7), k-split is-reverse, k-row (is-between), k-stack, k-fill (prend la hauteur restante).
- Texte : k-eyebrow (surtitre avec filet), k-chapter (<b>02</b> Le constat), k-h-xl (144 px), k-h-l (100), k-h-m (68), k-h-s (40), k-lede (30), k-body (23), k-mono, k-accent, k-mark (surlignage), k-grad-text, k-tag (pastille).
- Logo : <div class="k-logo [is-small|is-large]"><img class="client-logo" src="{{LOGO}}" alt=""></div> (pastille blanche, lisible sur tout fond). Co-marquage : <div class="k-cobrand"><div class="k-logo">…</div><span class="k-x">×</span><span class="k-nira">NIRA</span></div>
- Grand chiffre : <div class="k-stat [is-xl|is-m]"><b>6 j</b><span>délai d'un devis</span><small>contexte</small></div> ; plusieurs : <div class="k-stats">…</div>
- Citation : <figure class="k-quote [is-m]"><blockquote>…</blockquote><cite>Nom, fonction</cite></figure>
- Cartes : <div class="k-cards" style="--cols:3"><article class="k-card [is-brand|is-dark|is-soft|is-outline|is-ghost]"><span class="k-num">01</span><h3>…</h3><p>…</p></article></div> ; pictogramme : <div class="k-icon"><svg viewBox="0 0 24 24">…</svg></div>
- Flux : <div class="k-flow [is-vertical]"><div class="k-step [is-highlight|is-pain]"><span class="k-num">01</span><h3>…</h3><p>…</p></div>…</div> (flèches automatiques, 3 à 5 étapes)
- Frise : <div class="k-timeline" style="--n:4"><div class="k-phase [is-active]"><span class="k-when">Semaine 1</span><h3>…</h3><p>…</p></div>…</div>
- Étoile (un centre relié à 3 à 6 éléments) : <div class="k-hub"><div class="k-hub-core">Votre devis</div><div class="k-hub-item [is-highlight]" style="--i:0;--n:4"><b>Batappli</b><span>…</span></div>…</div> (--i de 0 à n-1)
- Barres : <div class="k-bars"><div class="k-bar [is-muted]" style="--v:62"><span>Libellé</span><i></i><b>62 %</b></div>…</div>
- Avant / après : <div class="k-versus"><div class="is-before"><span class="k-mono">Aujourd'hui</span><h3>…</h3><p>…</p></div><span class="k-vs">VS</span><div class="is-after">…</div></div>
- Matrice : <div class="k-matrix"><span class="k-q is-tr">Prioritaire</span>…<span class="k-axis-x">Effort</span><span class="k-axis-y">Impact</span><span class="k-dot [is-muted]" style="--x:25;--y:80">Pré-devis vocal</span></div>
- Listes : <ul class="k-checks [is-cols]"><li>…</li></ul> ; <ol class="k-numbers"><li><div><b>Titre</b><span>détail</span></div></li></ol>
- Prix : <div class="k-price"><b>{{PRICE}}</b><span>TTC · forfait</span></div> (prévois-lui au moins 560 px de large)
- Encadré : <div class="k-panel [is-brand]">…</div> ; filet : <hr class="k-divider">
- Décor (derrière le contenu) : <div class="k-deco k-circle k-w-m k-tr"></div>, aussi k-ring, k-dots, k-lines ; tailles k-w-s/m/l ; positions k-tr, k-br, k-tl, k-bl (ou style="right:…;top:…").

# 4. Contraintes techniques (impératives)
- Chaque slide est une toile fixe de 1600 × 900 px, à remplir avec un k-slide. Le contenu doit tenir sans débordement : compte la place (titre + composant + une ligne, pas plus).
- Variables CSS disponibles, à utiliser pour toutes les couleurs et polices : --primary (couleur de marque brute), --accent (version lisible sur fond blanc), --accent-2 (couleur secondaire lisible), --grad-a et --grad-b (aplats et dégradés sur lesquels le texte blanc est lisible), --ink (texte), --muted (texte secondaire), --line (filets), --bg et --bg-2 (fonds clairs teintés), --soft et --soft-2 (fonds de cartes), --shadow ; polices --f-head (titres), --f-body (texte), --f-mono (étiquettes) ; --hw (graisse des titres).
- Dans ton CSS, n'utilise jamais --ink ou --muted comme couleur de FOND : sur fond sombre elles deviennent blanches. Pour un fond sombre sur mesure, utilise --ink-0 (la couleur de texte d'origine, toujours foncée).
- Si la couleur de marque est très claire, n'écris jamais de texte avec --primary sur fond clair : réserve-la aux aplats et aux formes, avec du texte --ink dessus.
- Le logo du client : src="{{LOGO}}", de préférence dans un k-logo. Le prix total s'écrit exactement {{PRICE}}. Le nom du commercial {{SELLER}}, la date {{DATE}}.
- Préfixe toutes tes classes CSS par « d- » pour éviter les conflits. Pas de <script>, pas d'attribut on…, pas d'url() ni de ressource externe, pas d'animation infinie. Les numéros de page et la navigation sont ajoutés automatiquement.

# 5. Le contenu
Chaque slide parle du client : ses mots, ses chiffres, ses outils, ses équipes, ses citations exactes. Une slide qui pourrait servir chez un autre client est ratée.

${STYLE}`,
      input: `${dossier(input, true, website)}\n\n${brief ? briefJson(brief) : ''}`,
    }
  }

  if (step === 'proposal') {
    return {
      effort: 'low',
      instructions: `${NIRA}

Ta mission : rédiger la proposition commerciale écrite qui sera signée par le client. Elle reprend fidèlement l'analyse validée (périmètre, phases, livrables) dans un registre professionnel de cabinet de conseil : précis, rassurant, engageant. Le tableau de prix, les coordonnées et la zone de signature sont ajoutés automatiquement : ne les écris pas.

${STYLE}`,
      input: `${dossier(input, false, '')}\n\n${brief ? briefJson(brief) : ''}`,
    }
  }

  return {
    effort: 'low',
    instructions: `${NIRA}

Ta mission : rédiger la documentation technique des outils proposés au client, à destination de son décideur et de son responsable informatique. Elle doit être précise et réaliste : outils réels, connexions plausibles, hébergement et conformité RGPD, sans promesse impossible.
${input.sale === 'audit' ? "Il s'agit d'un audit : documente les outils que Nira recommande ou utilise dans le cadre de l'audit, et l'architecture cible envisagée, en précisant qu'elle sera confirmée par l'audit." : ''}

${STYLE}`,
    input: `${dossier(input, false, '')}\n\n${brief ? briefJson(brief) : ''}`,
  }
}
