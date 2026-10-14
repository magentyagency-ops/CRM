/**
 * Contrat entre le studio de génération (navigateur), la fonction serverless
 * `/api/proposals/generate` et les gabarits de rendu.
 *
 * Le modèle ne produit que du contenu structuré : la mise en page, les couleurs
 * et le logo du client sont appliqués ensuite par les gabarits. Une présentation
 * reste ainsi toujours propre, quelle que soit la réponse du modèle, et une
 * amélioration des gabarits profite aussi aux documents déjà générés.
 */

export type SaleKind = 'audit' | 'logiciel' | 'audit-logiciel'

export const SALE_KINDS: Record<SaleKind, string> = {
  audit: 'Audit',
  logiciel: 'Logiciel',
  'audit-logiciel': 'Audit + logiciel',
}

export type Typography = 'moderne' | 'editorial' | 'tech' | 'classique'

export interface Billing {
  legalName: string
  siret: string
  address: string
  postalCity: string
  signatory: string
  signatoryRole: string
  paymentTerms: string
}

export interface StudioInput {
  company: string
  contact: string
  contactRole: string
  sale: SaleKind
  offerDescription: string
  /** Montant total TTC voulu ; 0 = à proposer par le modèle. */
  price: number
  includeTechDoc: boolean
  specialRequest: string
  website: string
  /** Transcriptions des rendez-vous et notes écrites, mises bout à bout. */
  transcript: string
  /** Notes et historique du lead dans le CRM. */
  leadNotes: string
  billing: Billing
  seller: { name: string; email: string }
}

export interface Brand {
  /** Logo en data URL (PNG redimensionné ou SVG), vide si non fourni. */
  logo: string
  primary: string
  secondary: string
}

/* ------------------------------------------------------------ analyse */

export interface PricingLine {
  label: string
  description: string
  quantity: string
  unitPrice: number
  total: number
}

export interface Brief {
  projectTitle: string
  objet: string
  clientName: string
  sector: string
  context: string
  painPoints: { title: string; detail: string; evidence: string }[]
  goals: string[]
  keyFigures: { value: string; label: string; context: string }[]
  verbatims: { quote: string; speaker: string }[]
  stakeholders: { name: string; role: string; concern: string }[]
  objections: { objection: string; answer: string }[]
  solution: { name: string; pitch: string; pillars: { title: string; detail: string }[] }
  tools: { name: string; category: string; purpose: string; why: string }[]
  deliverables: { title: string; items: string[] }[]
  phases: { name: string; duration: string; objective: string; activities: string[] }[]
  expectedResults: { metric: string; value: string; detail: string }[]
  pricing: { lines: PricingLine[]; paymentTerms: string[]; validityDays: number }
  typography: Typography
  missingInfo: string[]
}

/* -------------------------------------------------------- présentation */

interface SlideBase {
  kicker: string
  statement: string
}

export type Slide =
  | (SlideBase & { layout: 'cover'; title: string; highlight: string; subtitle: string })
  | (SlideBase & { layout: 'context'; title: string; text: string; bullets: string[] })
  | (SlideBase & { layout: 'quote'; quote: string; speaker: string; comment: string })
  | (SlideBase & {
      layout: 'stats'
      title: string
      figure: { value: string; label: string; caption: string }
      points: string[]
    })
  | (SlideBase & { layout: 'pains'; title: string; items: { title: string; detail: string }[] })
  | (SlideBase & {
      layout: 'versus'
      title: string
      before: { label: string; value: string; text: string }
      after: { label: string; value: string; text: string }
    })
  | (SlideBase & { layout: 'flow'; title: string; steps: { title: string; caption: string }[] })
  | (SlideBase & { layout: 'pillars'; title: string; intro: string; items: { title: string; detail: string }[] })
  | (SlideBase & { layout: 'results'; title: string; items: { value: string; title: string; detail: string }[] })
  | (SlideBase & { layout: 'roadmap'; title: string; phases: { name: string; duration: string; detail: string }[] })
  | (SlideBase & { layout: 'offer'; title: string; offerName: string; pitch: string; priceNote: string; includes: string[] })
  | (SlideBase & { layout: 'closing'; title: string; subtitle: string; nextSteps: { title: string; detail: string }[] })

export interface Deck {
  slides: Slide[]
}

/* --------------------------------------------------- proposition écrite */

export interface ProposalDoc {
  title: string
  objet: string
  introduction: string
  context: { paragraphs: string[]; highlights: { value: string; label: string }[] }
  objectives: { title: string; detail: string }[]
  solution: { intro: string; blocks: { title: string; text: string }[] }
  methodology: { title: string; detail: string }[]
  deliverables: { title: string; items: string[] }[]
  planning: { phase: string; duration: string; detail: string }[]
  whyUs: { title: string; detail: string }[]
  conditions: string[]
}

/* ------------------------------------------------ documentation technique */

export interface TechDoc {
  title: string
  summary: string
  scope: string[]
  architecture: {
    overview: string
    layers: { name: string; components: { name: string; role: string; tech: string }[] }[]
  }
  flows: { step: string; from: string; to: string; data: string; frequency: string }[]
  tools: {
    name: string
    category: string
    purpose: string
    features: string[]
    integration: string
    hosting: string
    licence: string
  }[]
  dataAndSecurity: { title: string; detail: string }[]
  deployment: { step: string; detail: string }[]
  operations: { title: string; detail: string }[]
  prerequisites: string[]
  risks: { risk: string; mitigation: string }[]
}

export type GenerateStep = 'brief' | 'deck' | 'proposal' | 'techdoc'

export interface GeneratedContent {
  brief: Brief
  deck: Deck
  proposal: ProposalDoc
  techdoc: TechDoc | null
}

/** Une génération enregistrée en base, rattachée à un lead. */
export interface ProposalRecord {
  id: string
  leadId: string
  owner_id: string | null
  input: StudioInput
  brand: Brand
  content: GeneratedContent
  createdAt: string
}
