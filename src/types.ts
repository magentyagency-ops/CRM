export type Theme = 'light' | 'midnight' | 'ocean' | 'sunset'
/**
 * Étapes du pipeline. R1 et R2 sont le premier et le second rendez-vous : le
 * cycle de vente se raconte par les rendez-vous obtenus, pas par l'envoi d'une
 * proposition.
 */
export type Stage = 'qualified' | 'r1' | 'r2' | 'negotiation' | 'won' | 'lost'
export type Priority = 'low' | 'medium' | 'high'
/** Nature de ce qui est proposé au prospect. '' = non renseigné. */
export type Offer = '' | 'logiciel' | 'audit'
export type EventKind = 'call' | 'meeting' | 'demo' | 'followup' | 'internal'
/** Issue d'un appel de prospection, reprise des listes du suivi d'appels. */
export type CallOutcome = 'no-answer' | 'voicemail' | 'answered'
/** Raison invoquée quand l'appel n'aboutit pas à un rendez-vous. '' = non renseignée. */
export type CallReason = '' | 'not-interested' | 'no-budget' | 'wrong-contact' | 'bad-timing' | 'has-provider' | 'other'
/** Objection principale entendue pendant la conversation. '' = aucune. */
export type CallObjection = '' | 'price' | 'no-need' | 'timing' | 'has-provider' | 'decision-maker' | 'other'
export type ActivityKind = 'note' | 'call' | 'email' | 'meeting' | 'stage'

export interface Activity {
  id: string
  kind: ActivityKind
  text: string
  createdAt: string
}

export interface Lead {
  id: string
  contact: string
  company: string
  email: string
  phone: string
  role: string
  source: string
  owner: string
  stage: Stage
  value: number
  probability: number
  priority: Priority
  offer: Offer
  nextStep: string
  expectedCloseAt: string
  tags: string[]
  notes: string
  /** Compte propriétaire du lead ; sert de clé de cloisonnement côté RLS. */
  owner_id: string | null
  activities: Activity[]
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  kind: EventKind
  start: string
  end: string
  leadId: string | null
  location: string
  notes: string
  done: boolean
  owner_id: string | null
  createdAt: string
  updatedAt: string
}

/** Un appel de prospection : une ligne du tableau de suivi. */
export interface Call {
  id: string
  /** Jour de l'appel au format AAAA-MM-JJ. */
  date: string
  contact: string
  company: string
  phone: string
  outcome: CallOutcome
  conversation: boolean
  meeting: boolean
  /** Date du rendez-vous obtenu, vide sinon. */
  meetingAt: string
  reason: CallReason
  objection: CallObjection
  notes: string
  nextAction: string
  followUpAt: string
  /** Opportunité du pipeline née de cet appel, ou null. */
  leadId: string | null
  owner_id: string | null
  createdAt: string
  updatedAt: string
}

export type Role = 'admin' | 'user'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  active: boolean
  theme: Theme
  created_at: string
}

export interface MemberStats {
  leads: number
  open: number
  openValue: number
  wonValue: number
  lastActivity: string
}

export interface Member extends Profile {
  stats: MemberStats
}

export interface AppState {
  theme: Theme
  leads: Lead[]
  events: CalendarEvent[]
  calls: Call[]
  /** Compte connecté, ou null tant que la session n'est pas établie. */
  profile: Profile | null
  /** Comptes visibles : tous pour un admin, uniquement le sien pour un user. */
  members: Profile[]
  /** Filtre du pipeline : liste d'owner_id, vide = tous les comptes. */
  ownerFilter: string[]
}
