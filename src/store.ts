import type { AppState, CalendarEvent, Lead, Profile } from './types.js'

type Listener = () => void

const listeners = new Set<Listener>()

export const state: AppState = {
  theme: 'light',
  leads: [],
  events: [],
  profile: null,
  members: [],
  ownerFilter: [],
}

export function subscribe(listener: Listener): void {
  listeners.add(listener)
}

export function notify(): void {
  listeners.forEach((listener) => listener())
}

export function hydrate(next: AppState): void {
  state.theme = next.theme
  state.leads = next.leads
  state.events = next.events
  state.profile = next.profile
  state.members = next.members
  // Un filtre pointant vers un compte disparu serait invisible : on le nettoie.
  state.ownerFilter = state.ownerFilter.filter((id) => next.members.some((member) => member.id === id))
  notify()
}

export const isAdmin = (): boolean => state.profile?.role === 'admin'

export function setMembers(members: Profile[]): void {
  state.members = members
  notify()
}

export function setOwnerFilter(ownerIds: string[]): void {
  state.ownerFilter = ownerIds
  notify()
}

/** Nom lisible d'un compte, pour les cartes et les tableaux. */
export function memberName(ownerId: string | null): string {
  if (!ownerId) return 'Non attribué'
  const member = state.members.find((item) => item.id === ownerId)
  if (!member) return 'Compte supprimé'
  return member.full_name || member.email
}

/** Applique le filtre par propriétaire ; un filtre vide laisse tout passer. */
export const matchesOwnerFilter = (lead: Lead): boolean =>
  state.ownerFilter.length === 0 || state.ownerFilter.includes(lead.owner_id ?? '')

export function upsertLead(lead: Lead): void {
  const index = state.leads.findIndex((item) => item.id === lead.id)
  if (index === -1) state.leads.unshift(lead)
  else state.leads[index] = lead
  notify()
}

export function removeLead(id: string): void {
  state.leads = state.leads.filter((item) => item.id !== id)
  state.events = state.events.map((event) => (event.leadId === id ? { ...event, leadId: null } : event))
  notify()
}

export function upsertEvent(event: CalendarEvent): void {
  const index = state.events.findIndex((item) => item.id === event.id)
  if (index === -1) state.events.push(event)
  else state.events[index] = event
  notify()
}

export function removeEvent(id: string): void {
  state.events = state.events.filter((item) => item.id !== id)
  notify()
}

export const findLead = (id: string | null): Lead | undefined =>
  id ? state.leads.find((lead) => lead.id === id) : undefined
