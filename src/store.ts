import type { AppState, CalendarEvent, Lead } from './types.js'

type Listener = () => void

const listeners = new Set<Listener>()

export const state: AppState = { theme: 'light', leads: [], events: [] }

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
  notify()
}

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
