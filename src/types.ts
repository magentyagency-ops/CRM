export type Theme = 'light' | 'midnight' | 'ocean' | 'sunset'
export type Stage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type Priority = 'low' | 'medium' | 'high'
/** Nature de ce qui est proposé au prospect. '' = non renseigné. */
export type Offer = '' | 'logiciel' | 'audit'
export type EventKind = 'call' | 'meeting' | 'demo' | 'followup' | 'internal'
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
  /** Compte connecté, ou null tant que la session n'est pas établie. */
  profile: Profile | null
  /** Comptes visibles : tous pour un admin, uniquement le sien pour un user. */
  members: Profile[]
  /** Filtre du pipeline : liste d'owner_id, vide = tous les comptes. */
  ownerFilter: string[]
}
