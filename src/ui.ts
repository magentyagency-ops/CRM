import type { ActivityKind, EventKind, Lead, Priority, Stage } from './types.js'

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

export const EVENT_KINDS: Record<EventKind, { label: string; icon: string; color: string }> = {
  call: { label: 'Appel', icon: 'ri-phone-line', color: 'var(--blue)' },
  meeting: { label: 'Rendez-vous', icon: 'ri-calendar-event-line', color: 'var(--violet)' },
  demo: { label: 'Démo', icon: 'ri-presentation-line', color: 'var(--cyan)' },
  followup: { label: 'Relance', icon: 'ri-mail-send-line', color: 'var(--amber)' },
  internal: { label: 'Interne', icon: 'ri-team-line', color: 'var(--muted)' },
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

export const formatDate = (iso: string): string =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (iso: string): string =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function relativeDays(iso: string): string {
  if (!iso) return '—'
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'demain'
  if (days === -1) return 'hier'
  return days > 0 ? `dans ${days} j` : `il y a ${Math.abs(days)} j`
}

export const initials = (lead: Lead): string => {
  const source = (lead.company || lead.contact || '?').trim()
  if (!source) return '?'
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

const AVATAR_PALETTES = [
  'avatar-blue',
  'avatar-indigo',
  'avatar-purple',
  'avatar-emerald',
  'avatar-amber',
  'avatar-rose',
  'avatar-cyan',
  'avatar-pink',
]

export function leadColorClass(lead: Lead): string {
  const seed = lead.company || lead.contact || lead.id || ''
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length
  return AVATAR_PALETTES[index]
}

export function leadAvatarHtml(lead: Lead, extraClass = ''): string {
  const cls = ['lead-avatar', leadColorClass(lead), extraClass].filter(Boolean).join(' ')
  return `<span class="${cls}">${escapeHtml(initials(lead))}</span>`
}

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
