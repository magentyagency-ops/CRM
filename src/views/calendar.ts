import { api } from '../api.js'
import { openEventForm } from '../forms.js'
import { findLead, state, subscribe, upsertEvent } from '../store.js'
import type { CalendarEvent } from '../types.js'
import {
  $,
  $$,
  EVENT_KINDS,
  addDays,
  emptyBlock,
  escapeHtml,
  formatTime,
  sameDay,
  startOfDay,
  startOfWeek,
  toast,
  viewIsActive,
} from '../ui.js'

type Mode = 'month' | 'week' | 'agenda'

const DOW = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

let mode: Mode = 'month'
let cursor = startOfDay(new Date())

export function initCalendar(): void {
  $('#calendarPrev').addEventListener('click', () => shift(-1))
  $('#calendarNext').addEventListener('click', () => shift(1))
  $('#calendarToday').addEventListener('click', () => {
    cursor = startOfDay(new Date())
    render()
  })

  $$('#calendarModes .seg').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode as Mode
      $$('#calendarModes .seg').forEach((item) => item.classList.toggle('active', item === button))
      render()
    })
  })

  subscribe(render)
  render()
}

function shift(direction: number): void {
  if (mode === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1)
  else if (mode === 'week') cursor = addDays(cursor, 7 * direction)
  else cursor = addDays(cursor, 14 * direction)
  render()
}

const eventsOfDay = (day: Date): CalendarEvent[] =>
  state.events
    .filter((event) => sameDay(new Date(event.start), day))
    .sort((a, b) => a.start.localeCompare(b.start))

function eventPill(event: CalendarEvent): string {
  const kind = EVENT_KINDS[event.kind]
  const lead = findLead(event.leadId)
  const leadLabel = lead ? (lead.company || lead.contact) : ''
  const title = leadLabel ? `${event.title} · ${leadLabel}` : event.title
  return `
    <button class="event-pill${event.done ? ' done' : ''}" type="button" draggable="true" data-event="${event.id}" title="${escapeHtml(title)}">
      <span class="dot" style="background:${kind.color}"></span>
      <time>${formatTime(event.start)}</time>
      <span style="overflow:hidden;text-overflow:ellipsis">${escapeHtml(event.title)}</span>
    </button>`
}

function render(): void {
  if (!viewIsActive('calendar')) return
  const label = $('#calendarLabel')
  const eyebrow = $('#calendarEyebrow')
  const body = $('#calendarBody')

  if (mode === 'month') {
    eyebrow.textContent = 'Mois'
    label.textContent = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    body.innerHTML = renderMonth()
  } else if (mode === 'week') {
    const start = startOfWeek(cursor)
    eyebrow.textContent = 'Semaine'
    label.textContent = `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} — ${addDays(start, 6).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
    body.innerHTML = renderWeek(start)
  } else {
    eyebrow.textContent = 'Liste'
    label.textContent = 'Prochains rendez-vous'
    body.innerHTML = renderAgenda()
  }

  bindEvents(body)
  bindDays(body)
}

function renderMonth(): string {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = startOfWeek(first)
  const today = new Date()
  const cells: string[] = DOW.map((day) => `<div class="month-dow">${day}</div>`)

  for (let index = 0; index < 42; index += 1) {
    const day = addDays(start, index)
    const events = eventsOfDay(day)
    const shown = events.slice(0, 3)
    cells.push(`
      <div class="day-cell${day.getMonth() === cursor.getMonth() ? '' : ' outside'}${sameDay(day, today) ? ' today' : ''}" data-day="${day.toISOString()}">
        <span class="day-num">${day.getDate()}</span>
        ${shown.map(eventPill).join('')}
        ${events.length > shown.length ? `<span class="day-more">+${events.length - shown.length} autre(s)</span>` : ''}
      </div>`)
  }

  return `<div class="month-grid">${cells.join('')}</div>`
}

function renderWeek(start: Date): string {
  const today = new Date()
  const columns = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index)
    const events = eventsOfDay(day)
    return `
      <div class="week-col${sameDay(day, today) ? ' today' : ''}" data-day="${day.toISOString()}">
        <header><b>${day.getDate()}</b><small>${DOW[index]}</small></header>
        ${
          events.length
            ? events.map(eventPill).join('')
            : '<span class="day-more">Libre — clique pour planifier</span>'
        }
      </div>`
  })
  return `<div class="week-grid">${columns.join('')}</div>`
}

function renderAgenda(): string {
  const from = startOfDay(cursor)
  const upcoming = state.events
    .filter((event) => new Date(event.start) >= from)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 40)

  if (!upcoming.length) {
    return emptyBlock(
      'ri-calendar-line',
      'Aucun rendez-vous à venir',
      'Planifie un appel ou une démo depuis un lead du pipeline.',
      false,
    )
  }

  const groups = new Map<string, CalendarEvent[]>()
  upcoming.forEach((event) => {
    const key = new Date(event.start).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    groups.set(key, [...(groups.get(key) ?? []), event])
  })

  return `<div class="agenda-list">${[...groups.entries()]
    .map(
      ([day, events]) => `
      <p class="agenda-day">${day}</p>
      ${events
        .map((event) => {
          const kind = EVENT_KINDS[event.kind]
          const lead = findLead(event.leadId)
          const leadLabel = lead ? (lead.company ? `${lead.company}${lead.contact ? ` (${lead.contact})` : ''}` : lead.contact) : ''
          return `
          <button class="agenda-item" type="button" data-event="${event.id}">
            <span class="agenda-time">${formatTime(event.start)}</span>
            <span>
              <b>${escapeHtml(event.title)}</b>
              <span>${kind.label}${leadLabel ? ` · ${escapeHtml(leadLabel)}` : ''}${event.location ? ` · ${escapeHtml(event.location)}` : ''}</span>
            </span>
            <span class="chip ${event.done ? 'green' : 'muted'}">${event.done ? 'fait' : kind.label}</span>
          </button>`
        })
        .join('')}`,
    )
    .join('')}</div>`
}

function bindEvents(body: HTMLElement): void {
  body.querySelectorAll<HTMLElement>('[data-event]').forEach((node) => {
    const event = state.events.find((item) => item.id === node.dataset.event)
    if (!event) return

    node.addEventListener('click', (clickEvent) => {
      clickEvent.stopPropagation()
      openEventForm(event)
    })

    node.addEventListener('dragstart', (dragEvent) => {
      ;(dragEvent as DragEvent).dataTransfer?.setData('text/plain', event.id)
    })
  })
}

function bindDays(body: HTMLElement): void {
  body.querySelectorAll<HTMLElement>('[data-day]').forEach((cell) => {
    const day = new Date(cell.dataset.day as string)

    cell.addEventListener('click', () => {
      const start = new Date(day)
      start.setHours(9, 0, 0, 0)
      openEventForm(undefined, { start })
    })

    cell.addEventListener('dragover', (event) => {
      event.preventDefault()
      cell.classList.add('drag-over')
    })

    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'))

    cell.addEventListener('drop', async (dropEvent) => {
      dropEvent.preventDefault()
      cell.classList.remove('drag-over')
      const id = (dropEvent as DragEvent).dataTransfer?.getData('text/plain')
      const event = state.events.find((item) => item.id === id)
      if (!event) return
      await moveEvent(event, day)
    })
  })
}

async function moveEvent(event: CalendarEvent, day: Date): Promise<void> {
  const start = new Date(event.start)
  const duration = new Date(event.end).getTime() - start.getTime()
  const nextStart = new Date(day)
  nextStart.setHours(start.getHours(), start.getMinutes(), 0, 0)
  if (sameDay(start, nextStart)) return

  try {
    upsertEvent(
      await api.updateEvent(event.id, {
        start: nextStart.toISOString(),
        end: new Date(nextStart.getTime() + duration).toISOString(),
      }),
    )
    toast('Rendez-vous déplacé.')
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}
