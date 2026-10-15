import type { Brief, GenerateStep, StudioInput } from '../../src/proposals/model.js'
import type { WebsiteInfo } from './openai.js'

/** Charte transmise par le navigateur pour la présentation : couleurs et logo. */
export interface BrandInput {
  primary: string
  secondary: string
  logo: string
}

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
  concept: str('La direction artistique retenue, en 3 phrases : ce que tu as observé de l’identité du client, et comment la présentation la prolonge'),
  fonts: arr(str('Nom exact d’une famille Google Fonts, ex. « Inter », « Playfair Display »'), '1 ou 2 polices : celles du client si elles existent sur Google Fonts, sinon les plus proches'),
  css: str('Feuille de style complète de la présentation (sans balise <style>), classes préfixées d-'),
  slides: arr(
    obj({
      title: str('Titre court de la slide, pour la navigation'),
      html: str("Contenu HTML de la slide, sans la balise <section> qui l'entoure"),
    }),
    '7 à 14 slides',
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
  /** Image jointe à la demande (le logo du client), en data URL. */
  image?: string
  effort: 'low' | 'medium' | 'high'
}

export function buildPrompt(
  step: GenerateStep,
  input: StudioInput,
  brief: Brief | null,
  site: WebsiteInfo,
  brand: BrandInput | null = null,
): StepPrompt {
  const website = site.text
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
    const identity = [
      brand?.logo ? "Le logo du client est joint en image : observe sa forme, sa typographie, son niveau de sophistication, son ambiance." : "Aucun logo fourni.",
      brand ? `Couleurs relevées sur le logo : principale ${brand.primary}${brand.secondary ? `, secondaire ${brand.secondary}` : ''}.` : '',
      site.identity ? `Relevé du site web du client :\n${site.identity}` : "Site web non fourni ou illisible : déduis l'identité du logo, du secteur et du discours du client.",
    ]
      .filter(Boolean)
      .join('\n')
    return {
      effort: 'high',
      image: brand?.logo || undefined,
      instructions: `${NIRA}

Tu es directeur artistique et stratège dans une agence de design de premier plan. Tu crées ENTIÈREMENT SUR MESURE la présentation commerciale que Nira projettera au R2 devant ce prospect : le récit, la direction artistique, la mise en page et le code HTML/CSS de chaque slide. Il n'existe ni gabarit, ni bibliothèque, ni exemple à suivre : une page blanche, pour ce client et lui seul.

# 1. Le fond : ses besoins réels
Relis tout le dossier et l'analyse. Identifie ce que ce prospect veut vraiment obtenir, ce qui le freine, ce qui le fera signer, et qui décide. La présentation est la réponse à CES enjeux, dans SES mots : ses chiffres, ses outils, ses équipes, ses citations exactes, la démo qu'il a vue. Choisis la structure (7 à 14 slides) qui sert le mieux ce récit précis : il n'y a pas de trame imposée. Une slide = une idée forte. Obligatoire : l'ouverture avec son logo, la proposition et son prix ({{PRICE}}), la prochaine étape.

# 2. La forme : la direction artistique DU CLIENT
La présentation doit sembler sortir de chez le client : on doit y reconnaître sa marque au premier coup d'œil.
${identity}
- Reprends SES couleurs exactes (codes hexadécimaux du site et du logo) comme palette principale, dans les proportions de sa marque : une marque sobre reste sobre, une marque vive reste vive. Définis tes propres variables CSS dans :root.
- Reprends SES polices (champ « fonts ») si elles sont sur Google Fonts, sinon les plus proches en caractère.
- Prolonge son univers : angles vifs ou formes douces comme sur son site, densité, usage des capitales, motifs graphiques inspirés de son logo ou de son métier (dessinés en CSS ou en SVG).
- Le logo s'affiche avec <img class="client-logo" src="{{LOGO}}" alt="${input.company}"> ; fixe sa hauteur dans ton CSS. Place-le sur un fond où il est parfaitement lisible.

# 3. L'exigence : créatif, professionnel, aéré
- Niveau attendu : une agence de design haut de gamme. Chaque slide est une composition pensée, pas un document.
- De l'air : marges généreuses (au moins 100 px), beaucoup de vide, une seule idée par slide, 35 mots maximum hors schéma. Taille du texte : jamais moins de 20 px ; titres de 56 à 150 px.
- Une vraie hiérarchie, de la variété d'une slide à l'autre (compositions asymétriques, pleine page de couleur, très grand chiffre, citation seule, schéma, comparaison), et un fil visuel commun qui fait système.
- Visualise les idées : schémas de processus, comparaisons avant / après, graphiques à partir des vrais chiffres, cartographie des outils, en HTML/CSS ou en SVG.
- Proscrits : listes à puces en série, cartes toutes identiques, textes serrés, dégradés criards, emojis, clichés de « présentation d'agence IA » (robots, cerveaux, circuits) sauf si c'est l'univers du client.

# 4. Contraintes techniques (impératives)
- Chaque slide est une toile fixe de 1600 × 900 px (élément <section class="slide"> en position:relative, overflow:hidden, fourni). Ton HTML la remplit, typiquement avec un conteneur en position:absolute; inset:0.
- Tu ne vois pas le rendu : construis les mises en page avec CSS Grid et Flexbox, jamais avec des éléments positionnés au pixel près qui doivent s'aligner entre eux. Ne dessine pas de traits de liaison entre des blocs HTML : pour un schéma relié, fais-le entièrement dans un seul SVG avec son viewBox, ou utilise des flèches posées entre les blocs dans la grille. Les éléments en position absolue ne servent qu'au décor.
- Compte la place : le contenu doit tenir dans 900 px de haut sans débordement. Et à l'inverse, occupe toute la toile : équilibre la composition sur toute la hauteur (centrage vertical, éléments ancrés en bas, grand visuel), jamais un bloc tassé en haut avec un grand vide dessous.
- Toutes tes classes sont préfixées « d- ». Pas de <script>, pas d'attribut on…, pas d'url() ni d'image externe, pas d'@import (les polices sont chargées à partir du champ « fonts »). La navigation et la numérotation sont ajoutées automatiquement en bas à droite (laisse 60 px libres dans ce coin).
- Placeholders : {{LOGO}}, {{PRICE}}, {{SELLER}} (le commercial), {{DATE}}.

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
