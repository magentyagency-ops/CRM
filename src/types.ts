export type Theme = 'light' | 'midnight' | 'ocean' | 'sunset'
export type Stage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type Priority = 'low' | 'medium' | 'high'
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
  nextStep: string
  expectedCloseAt: string
  tags: string[]
  notes: string
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
  createdAt: string
  updatedAt: string
}

export interface AppState {
  theme: Theme
  leads: Lead[]
  events: CalendarEvent[]
}
