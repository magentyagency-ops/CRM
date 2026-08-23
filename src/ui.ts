import type {
  ActivityKind,
  CallObjection,
  CallOutcome,
  CallReason,
  EventKind,
  Lead,
  Offer,
  Priority,
  Stage,
} from './types.js'

/* ------------------------------------------------------------ référentiel */

export interface StageMeta {
  id: Stage
  label: string
  color: string
  probability: number
  closed?: 'won' | 'lost'
}

export const STAGES: StageMeta[] = [
  { id: 'new', label: 'Nouveau', color: 'var(--blue-2)', probability: 10 },
  { id: 'qualified', label: 'Qualifié', color: 'var(--cyan)', probability: 30 },
  { id: 'proposal', label: 'Proposition', color: 'var(--violet)', probability: 55 },
  { id: 'negotiation', label: 'Négociation', color: 'var(--amber)', probability: 75 },
  { id: 'won', label: 'Gagné', color: 'var(--green)', probability: 100, closed: 'won' },
  { id: 'lost', label: 'Perdu', color: 'var(--red)', probability: 0, closed: 'lost' },
]

export const stageMeta = (stage: Stage): StageMeta => STAGES.find((item) => item.id === stage) ?? STAGES[0]

export const PRIORITIES: Record<Priority, { label: string; chip: string }> = {
  high: { label: 'Haute', chip: 'red' },
  medium: { label: 'Moyenne', chip: 'amber' },
  low: { label: 'Basse', chip: 'muted' },
}

export const OFFERS: Record<Offer, { label: string; chip: string; icon: string }> = {
  '': { label: 'Offre non définie', chip: 'muted', icon: 'ri-question-line' },
  logiciel: { label: 'Logiciel', chip: 'violet', icon: 'ri-code-box-line' },
  audit: { label: 'Audit', chip: 'green', icon: 'ri-search-eye-line' },
}

export const EVENT_KINDS: Record<EventKind, { label: string; icon: string; color: string }> = {
  call: { label: 'Appel', icon: 'ri-phone-line', color: 'var(--blue)' },
  meeting: { label: 'Rendez-vous', icon: 'ri-calendar-event-line', color: 'var(--violet)' },
  demo: { label: 'Démo', icon: 'ri-presentation-line', color: 'var(--cyan)' },
  followup: { label: 'Relance', icon: 'ri-mail-send-line', color: 'var(--amber)' },
  internal: { label: 'Interne', icon: 'ri-team-line', color: 'var(--muted)' },
}

/* --------------------------------------------------- suivi des appels */

/** Issues d'appel, dans l'ordre croissant d'engagement du prospect. */
export const CALL_OUTCOMES: Record<CallOutcome, { label: string; short: string; chip: string; icon: string; color: string }> = {
  'no-answer': { label: 'Sans réponse', short: 'Sans réponse', chip: 'muted', icon: 'ri-phone-off-line', color: 'var(--muted)' },
  voicemail: { label: 'Messagerie vocale', short: 'Messagerie', chip: 'amber', icon: 'ri-voiceprint-line', color: 'var(--amber)' },
  answered: { label: 'A répondu', short: 'A répondu', chip: 'green', icon: 'ri-phone-line', color: 'var(--green)' },
}

export const CALL_REASONS: Record<CallReason, string> = {
  '': 'Non renseignée',
  'not-interested': 'Pas intéressé',
  'no-budget': 'Pas de budget',
  'wrong-contact': 'Mauvais contact',
  'bad-timing': 'Mauvais timing',
  'has-provider': 'Déjà un fournisseur',
  other: 'Autre',
}

export const CALL_OBJECTIONS: Record<CallObjection, string> = {
  '': 'Aucune',
  price: 'Prix',
  'no-need': 'Pas de besoin',
  timing: 'Timing',
  'has-provider': 'Déjà un fournisseur',
  'decision-maker': 'Décideur',
  other: 'Autre',
}

export const ACTIVITY_ICONS: Record<ActivityKind, string> = {
  note: 'ri-sticky-note-line',
  call: 'ri-phone-line',
  email: 'ri-mail-line',
  meeting: 'ri-calendar-event-line',
  stage: 'ri-flow-chart',
}

/* ------------------------------------------------------------------ dom */

export const $ = <T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = document): T => {
  const node = scope.querySelector<T>(selector)
  if (!node) throw new Error(`Élément introuvable : ${selector}`)
  return node
}

export const $$ = <T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = document): T[] =>
  Array.from(scope.querySelectorAll<T>(selector))

/**
 * Une vue masquée n'a pas besoin d'être reconstruite : sans ce garde-fou, la
 * moindre modification de données refabrique le pipeline, le tableau, l'agenda
 * et le tableau de bord d'un coup, dont trois invisibles.
 */
export const viewIsActive = (id: string): boolean =>
  document.getElementById(`view-${id}`)?.classList.contains('active') ?? false

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  )
}

let toastTimer: number | undefined

export function toast(message: string, variant: 'info' | 'error' = 'info'): void {
  const node = $('#toast')
  node.textContent = message
  node.className = `toast show${variant === 'error' ? ' error' : ''}`
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => node.classList.remove('show'), 2600)
}

/* ----------------------------------------------------------- formatteurs */

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export const formatMoney = (value: number): string => currency.format(value || 0)

export const formatCompactMoney = (value: number): string =>
  value >= 1000 ? `${Math.round(value / 100) / 10} k€` : `${Math.round(value)} €`

/**
 * Une date sans heure (« 2026-08-22 ») est lue comme minuit UTC par le moteur
 * JavaScript : à l'ouest de Greenwich elle s'afficherait la veille. On la
 * reconstruit donc dans le fuseau local, les horodatages complets restant
 * interprétés normalement.
 */
export const parseDay = (value: string): Date => {
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!jour) return new Date(value)
  return new Date(Number(jour[1]), Number(jour[2]) - 1, Number(jour[3]))
}

export const formatDate = (iso: string): string =>
  iso ? parseDay(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (iso: string): string =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function relativeDays(iso: string): string {
  if (!iso) return '—'
  const days = Math.round((parseDay(iso).getTime() - Date.now()) / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'demain'
  if (days === -1) return 'hier'
  return days > 0 ? `dans ${days} j` : `il y a ${Math.abs(days)} j`
}

/** Jour au format AAAA-MM-JJ dans le fuseau local, pour les champs `date`. */
export const todayKey = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

/** Date courte « 14 mars », suffisante dans un tableau dense. */
export const formatDayShort = (value: string): string =>
  value ? parseDay(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'

/** Initiales d'un couple société / contact, sans passer par un lead complet. */
export const initialsOf = (primary: string, fallback = ''): string =>
  (primary || fallback || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')

export const initials = (lead: Lead): string => initialsOf(lead.company, lead.contact)

export const weightedValue = (lead: Lead): number => (lead.value * lead.probability) / 100

/* ------------------------------------------------------------ dates util */

export const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Lundi de la semaine contenant `date`. */
export const startOfWeek = (date: Date): Date => {
  const day = (date.getDay() + 6) % 7
  return addDays(startOfDay(date), -day)
}

export const toDateInput = (iso: string): string => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

export const toDateTimeInput = (iso: string): string => {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export const fromDateTimeInput = (value: string): string => (value ? new Date(value).toISOString() : '')

export const emptyBlock = (icon: string, title: string, hint: string, compact = true): string => `
  <div class="empty${compact ? ' compact' : ''}">
    <div><i class="${icon}"></i><b>${escapeHtml(title)}</b><span>${escapeHtml(hint)}</span></div>
  </div>`
