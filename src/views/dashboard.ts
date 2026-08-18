import { openLeadDrawer } from '../drawer.js'
import { openEventForm } from '../forms.js'
import { findLead, state, subscribe } from '../store.js'
import type { CalendarEvent, Lead } from '../types.js'
import {
  $,
  EVENT_KINDS,
  PRIORITIES,
  STAGES,
  emptyBlock,
  escapeHtml,
  formatCompactMoney,
  formatDateTime,
  formatMoney,
  initials,
  relativeDays,
} from '../ui.js'

const OPEN_STAGES = STAGES.filter((stage) => !stage.closed).map((stage) => stage.id)

export function initDashboard(): void {
  subscribe(render)
  render()
}

function render(): void {
  const openLeads = state.leads.filter((lead) => OPEN_STAGES.includes(lead.stage))
  const won = state.leads.filter((lead) => lead.stage === 'won')
  const lost = state.leads.filter((lead) => lead.stage === 'lost')
  const pipelineValue = openLeads.reduce((sum, lead) => sum + lead.value, 0)
  const closed = won.length + lost.length
  const winRate = closed ? Math.round((won.length / closed) * 100) : 0

  const upcoming = state.events
    .filter((event) => new Date(event.start) >= new Date() && !event.done)
    .sort((a, b) => a.start.localeCompare(b.start))

  renderSummary(openLeads, pipelineValue, upcoming.length)
  renderMetrics(openLeads.length, pipelineValue, winRate, won)
  renderStageBars()
  renderFollowUps(openLeads)
  renderEvents(upcoming.slice(0, 6))
}

function renderSummary(openLeads: Lead[], pipelineValue: number, upcoming: number): void {
  const node = $('#dashboardSummary')
  if (!state.leads.length) {
    node.textContent =
      "Aucun lead pour le moment. Crée ta première opportunité pour voir ton pipeline s'animer ici."
    return
  }
  const hot = openLeads.filter((lead) => lead.priority === 'high').length
  const late = openLeads.filter(
    (lead) => lead.expectedCloseAt && new Date(lead.expectedCloseAt) < new Date(),
  ).length

  node.innerHTML = `
    ${openLeads.length} opportunité(s) ouverte(s) pour un total de <b>${formatMoney(pipelineValue)}</b>.
    ${hot ? `<b>${hot}</b> lead(s) en priorité haute` : 'Aucune priorité haute'} et
    ${upcoming} rendez-vous à venir.${late ? ` <b style="color:var(--red)">${late} date(s) de clôture dépassée(s).</b>` : ''}`
}

function renderMetrics(
  openCount: number,
  pipelineValue: number,
  winRate: number,
  won: Lead[],
): void {
  const wonValue = won.reduce((sum, lead) => sum + lead.value, 0)
  $('#dashboardMetrics').innerHTML = `
    <article class="metric glass"><small>Leads ouverts</small><strong>${openCount}</strong>
      <span class="metric-trend">${state.leads.length} au total</span></article>
    <article class="metric glass"><small>Valeur Pipeline</small><strong>${formatCompactMoney(pipelineValue)}</strong>
      <span class="metric-trend">${openCount} opportunité(s)</span></article>
    <article class="metric glass"><small>Taux de closing</small><strong>${winRate} %</strong>
      <span class="metric-trend ${winRate >= 50 ? 'up' : 'down'}">${won.length} affaire(s) gagnée(s)</span></article>
    <article class="metric glass"><small>Chiffre gagné</small><strong>${formatCompactMoney(wonValue)}</strong>
      <span class="metric-trend up">signé</span></article>`
}

function renderStageBars(): void {
  const node = $('#stageBars')
  if (!state.leads.length) {
    node.innerHTML = emptyBlock('ri-flow-chart', 'Pipeline vide', 'Ajoute des leads pour visualiser la répartition.')
    return
  }

  const totals = STAGES.map((stage) => {
    const leads = state.leads.filter((lead) => lead.stage === stage.id)
    return {
      stage,
      count: leads.length,
      value: leads.reduce((sum, lead) => sum + lead.value, 0),
    }
  })
  const max = Math.max(...totals.map((item) => item.value), 1)

  node.innerHTML = `<div class="stage-bars">${totals
    .map(
      (item) => `
      <div class="stage-bar">
        <b>${item.stage.label} <span class="muted">(${item.count})</span></b>
        <div class="stage-track"><div class="stage-fill" style="width:${Math.round((item.value / max) * 100)}%;background:${item.stage.color}"></div></div>
        <span>${formatCompactMoney(item.value)}</span>
      </div>`,
    )
    .join('')}</div>`
}

function renderFollowUps(openLeads: Lead[]): void {
  const node = $('#dashboardLeads')
  const weight: Record<Lead['priority'], number> = { high: 0, medium: 1, low: 2 }
  const leads = [...openLeads]
    .sort((a, b) => weight[a.priority] - weight[b.priority] || a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, 6)

  if (!leads.length) {
    node.innerHTML = emptyBlock('ri-user-search-line', 'Aucun lead ouvert', 'Tes opportunités actives apparaîtront ici.')
    return
  }

  node.innerHTML = `<div class="recent-list">${leads
    .map(
      (lead) => `
      <button class="recent-item" type="button" data-lead="${lead.id}">
        <span class="recent-icon">${escapeHtml(initials(lead))}</span>
        <span>
          <b>${escapeHtml(lead.company || 'Sans société')} <span class="chip ${PRIORITIES[lead.priority].chip}">${PRIORITIES[lead.priority].label}</span></b>
          <span>${escapeHtml([lead.contact, lead.role].filter(Boolean).join(' · ') || 'Sans contact')}${lead.nextStep ? ` · ${escapeHtml(lead.nextStep)}` : ''} · ${relativeDays(lead.updatedAt)}</span>
        </span>
        <span class="recent-value">${formatCompactMoney(lead.value)}</span>
      </button>`,
    )
    .join('')}</div>`

  node.querySelectorAll<HTMLElement>('[data-lead]').forEach((button) => {
    button.addEventListener('click', () => openLeadDrawer(button.dataset.lead as string))
  })
}

function renderEvents(list: CalendarEvent[]): void {
  const node = $('#dashboardEvents')

  if (!list.length) {
    node.innerHTML = emptyBlock('ri-calendar-line', 'Agenda libre', 'Planifie un appel ou une démo avec un lead.')
    return
  }

  node.innerHTML = `<div class="recent-list">${list
    .map((event) => {
      const kind = EVENT_KINDS[event.kind]
      const lead = findLead(event.leadId)
      const leadLabel = lead ? (lead.company ? `${lead.company}${lead.contact ? ` (${lead.contact})` : ''}` : lead.contact) : ''
      return `
        <button class="recent-item" type="button" data-event="${event.id}">
          <span class="recent-icon" style="color:${kind.color}"><i class="${kind.icon}"></i></span>
          <span>
            <b>${escapeHtml(event.title)}</b>
            <span>${formatDateTime(event.start)}${leadLabel ? ` · ${escapeHtml(leadLabel)}` : ''}</span>
          </span>
          <span class="recent-value">${relativeDays(event.start)}</span>
        </button>`
    })
    .join('')}</div>`

  node.querySelectorAll<HTMLElement>('[data-event]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = state.events.find((item) => item.id === button.dataset.event)
      if (target) openEventForm(target)
    })
  })
}
