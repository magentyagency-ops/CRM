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
const literal = (value: string): Schema => ({ type: 'string', enum: [value] })

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

const slideSchemas = [
  obj({
    layout: literal('cover'),
    kicker: str('Ex. « Proposition commerciale · Audit »'),
    title: str('Titre de couverture percutant, 5 à 9 mots, orienté bénéfice. Un « \\n » pour forcer le retour à la ligne.'),
    highlight: str('Fragment EXACT du titre à mettre en couleur, 1 à 3 mots'),
    subtitle: str('Une phrase, 25 mots maximum'),
    statement: str('Promesse en 12 mots maximum'),
  }),
  obj({
    layout: literal('context'),
    kicker: str(),
    title: str('6 à 10 mots'),
    text: str('2 phrases, 45 mots maximum'),
    bullets: arr(str('14 mots maximum'), '3 à 4 points'),
    statement: str(),
  }),
  obj({
    layout: literal('quote'),
    kicker: str(),
    quote: str('Citation exacte du client, 25 mots maximum'),
    speaker: str(),
    comment: str('Ce que cette phrase révèle, 20 mots maximum'),
    statement: str(),
  }),
  obj({
    layout: literal('stats'),
    kicker: str(),
    title: str(),
    figure: obj({ value: str('Très court : « 10k », « 3 h »'), label: str('4 mots maximum'), caption: str('12 mots maximum') }),
    points: arr(str('10 mots maximum'), '3 points'),
    statement: str(),
  }),
  obj({ layout: literal('pains'), kicker: str(), title: str(), items: arr(titleDetail, '3 à 4 éléments'), statement: str() }),
  obj({
    layout: literal('versus'),
    kicker: str(),
    title: str(),
    before: obj({ label: str('« Aujourd’hui »'), value: str('Très court'), text: str('25 mots maximum') }),
    after: obj({ label: str('« Avec … »'), value: str('Très court'), text: str('25 mots maximum') }),
    statement: str(),
  }),
  obj({
    layout: literal('flow'),
    kicker: str(),
    title: str(),
    steps: arr(obj({ title: str('1 à 3 mots'), caption: str('6 mots maximum') }), '3 à 5 étapes'),
    statement: str(),
  }),
  obj({
    layout: literal('pillars'),
    kicker: str(),
    title: str(),
    intro: str('Une phrase, 25 mots maximum'),
    items: arr(titleDetail, '4 éléments exactement'),
    statement: str(),
  }),
  obj({
    layout: literal('results'),
    kicker: str(),
    title: str(),
    items: arr(
      obj({ value: str('« −30 % », « 2 h/j », « ↗ »'), title: str('2 à 4 mots'), detail: str('15 mots maximum') }),
      '4 éléments exactement',
    ),
    statement: str(),
  }),
  obj({
    layout: literal('roadmap'),
    kicker: str(),
    title: str(),
    phases: arr(obj({ name: str('1 à 3 mots'), duration: str(), detail: str('20 mots maximum') }), '3 à 4 phases'),
    statement: str(),
  }),
  obj({
    layout: literal('offer'),
    kicker: str(),
    title: str(),
    offerName: str('Nom de l’offre, 3 à 7 mots'),
    pitch: str('25 mots maximum'),
    priceNote: str('Ex. « Forfait · TVA non applicable » ; ne JAMAIS écrire le prix, il est ajouté automatiquement'),
    includes: arr(str('10 mots maximum'), '4 à 6 éléments inclus'),
    statement: str(),
  }),
  obj({
    layout: literal('closing'),
    kicker: str(),
    title: str('5 à 8 mots'),
    subtitle: str(),
    nextSteps: arr(obj({ title: str('2 à 4 mots'), detail: str('12 mots maximum') }), '3 étapes'),
    statement: str(),
  }),
]

const deckSchema = obj({ slides: arr({ anyOf: slideSchemas }, '10 à 13 slides') })

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

Ta mission : écrire le contenu d'une présentation commerciale projetée lors du R2 avec le prospect. Un gabarit graphique haut de gamme aux couleurs du client se charge de la mise en page : tu choisis la mise en page de chaque slide et tu écris le texte.

Construis un récit, pas un catalogue. Trame conseillée (à adapter) :
cover → context (ce que nous avons compris) → quote (seulement s'il existe une vraie citation forte) → stats ou pains (le problème et son coût) → versus (avant / après) → pillars ou flow (la solution) → results (gains attendus) → roadmap → offer → closing (prochaines étapes).
- 10 à 13 slides. La première est « cover », la dernière « closing », une seule « offer », juste avant « closing ».
- Varie les mises en page : jamais deux fois la même à la suite.
- Chaque slide parle du client : ses mots, ses chiffres, ses outils. Le « statement » est la phrase à retenir de la slide.
- « stats » uniquement avec un vrai chiffre du client ; sinon préfère « pains ».
- Moins de texte, plus d'impact : c'est une présentation, pas un document.
- Si un titre annonce un nombre (« trois leviers », « quatre semaines »), il correspond exactement au nombre d'éléments de la slide.

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
