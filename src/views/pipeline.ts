import { changeStage, openLeadDrawer } from '../drawer.js'
import {
  findLead,
  isAdmin,
  matchesOwnerFilter,
  memberName,
  setOwnerFilter,
  state,
  subscribe,
} from '../store.js'
import type { Lead, Stage } from '../types.js'
import {
  $,
  PRIORITIES,
  STAGES,
  escapeHtml,
  formatCompactMoney,
  formatDate,
  initials,
  relativeDays,
} from '../ui.js'

let search = ''

export function initPipeline(): void {
  const searchInput = $<HTMLInputElement>('#pipelineSearch')
  searchInput.addEventListener('input', () => {
    search = searchInput.value.trim().toLowerCase()
    render()
  })
  initOwnerFilter()
  subscribe(render)
  render()
}

/* ----------------------------------------------- filtre par propriétaire */

function initOwnerFilter(): void {
  const wrap = $('#ownerFilter')

  $('#ownerFilterToggle').addEventListener('click', (event) => {
    event.stopPropagation()
    wrap.classList.toggle('open')
  })

  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target as Node)) wrap.classList.remove('open')
  })

  wrap.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-owner-action]')?.dataset.ownerAction
    if (action === 'all') setOwnerFilter(state.members.map((member) => member.id))
    if (action === 'none') setOwnerFilter([])
  })
}

function renderOwnerFilter(): void {
  const wrap = $('#ownerFilter')
  wrap.hidden = !isAdmin()
  if (!isAdmin()) return

  const selected = state.ownerFilter
  const label =
    selected.length === 0 || selected.length === state.members.length
      ? 'Tous les comptes'
      : selected.length === 1
        ? memberName(selected[0])
        : `${selected.length} comptes`
  $('#ownerFilterLabel').textContent = label

  const list = $('#ownerFilterList')
  list.innerHTML = state.members
    .map((member) => {
      const count = state.leads.filter((lead) => lead.owner_id === member.id).length
      const checked = selected.includes(member.id)
      return `
        <label class="owner-option${checked ? ' checked' : ''}">
          <input type="checkbox" value="${member.id}"${checked ? ' checked' : ''}>
          <span>
            <b>${escapeHtml(member.full_name || member.email.split('@')[0])}</b>
            <small>${count} deal(s)${member.role === 'admin' ? ' · admin' : ''}</small>
          </span>
        </label>`
    })
    .join('')

  list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const next = new Set(state.ownerFilter)
      if (checkbox.checked) next.add(checkbox.value)
      else next.delete(checkbox.value)
      setOwnerFilter([...next])
    })
  })
}

export function matchesSearch(lead: Lead, needle: string): boolean {
  if (!needle) return true
  const haystack = [lead.contact, lead.company, lead.role, lead.owner, lead.source, lead.nextStep, ...lead.tags]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function leadCard(lead: Lead): string {
  const priority = PRIORITIES[lead.priority]
  const closing = lead.expectedCloseAt
    ? `<span class="chip muted"><i class="ri-flag-line"></i>${formatDate(lead.expectedCloseAt)}</span>`
    : ''
  const contactSubtitle = [lead.contact, lead.role].filter(Boolean).join(' · ')
  return `
    <article class="lead-card" draggable="true" data-lead="${lead.id}">
      <div class="lead-card-top">
        <span class="lead-avatar">${escapeHtml(initials(lead))}</span>
        <div class="lead-card-header">
          <div class="lead-card-title-row">
            <b>${escapeHtml(lead.company || 'Sans société')}</b>
            <span class="lead-card-value">${formatCompactMoney(lead.value)}</span>
          </div>
          <span class="lead-contact">${escapeHtml(contactSubtitle || 'Sans contact')}</span>
        </div>
      </div>
      <div class="lead-card-meta">
        <span class="chip ${priority.chip}">${priority.label}</span>
        ${closing}
        ${isAdmin() ? `<span class="chip violet"><i class="ri-user-line"></i>${escapeHtml(memberName(lead.owner_id))}</span>` : ''}
      </div>
      ${lead.nextStep ? `<p class="lead-next"><i class="ri-arrow-right-up-line"></i> ${escapeHtml(lead.nextStep)}</p>` : ''}
      <p class="lead-next" style="opacity:.75">Dernière activité ${relativeDays(lead.updatedAt)}</p>
    </article>`
}

function render(): void {
  const board = $('#board')
  renderOwnerFilter()
  const visible = state.leads.filter((lead) => matchesSearch(lead, search) && matchesOwnerFilter(lead))

  board.innerHTML = STAGES.map((stage) => {
    const leads = visible.filter((lead) => lead.stage === stage.id)
    const total = leads.reduce((sum, lead) => sum + lead.value, 0)
    return `
      <section class="column glass" data-stage="${stage.id}">
        <header class="column-head">
          <span class="column-dot" style="background:${stage.color}"></span>
          <b>${stage.label}</b>
          <span class="count">${leads.length}</span>
        </header>
        <p class="column-total">${formatCompactMoney(total)}<span>au total</span></p>
        <div class="column-list" data-drop="${stage.id}">
          ${
            leads.length
              ? leads.map(leadCard).join('')
              : '<div class="column-empty">Dépose un lead ici</div>'
          }
        </div>
      </section>`
  }).join('')

  bindCards(board)
  bindColumns(board)
}

function bindCards(board: HTMLElement): void {
  board.querySelectorAll<HTMLElement>('.lead-card').forEach((card) => {
    const id = card.dataset.lead as string

    card.addEventListener('click', () => openLeadDrawer(id))

    card.addEventListener('dragstart', (event) => {
      card.classList.add('dragging')
      event.dataTransfer?.setData('text/plain', id)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    })

    card.addEventListener('dragend', () => card.classList.remove('dragging'))
  })
}

function bindColumns(board: HTMLElement): void {
  board.querySelectorAll<HTMLElement>('.column').forEach((column) => {
    const stage = column.dataset.stage as Stage

    column.addEventListener('dragover', (event) => {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      column.classList.add('drag-over')
    })

    column.addEventListener('dragleave', (event) => {
      if (!column.contains(event.relatedTarget as Node)) column.classList.remove('drag-over')
    })

    column.addEventListener('drop', (event) => {
      event.preventDefault()
      column.classList.remove('drag-over')
      const id = event.dataTransfer?.getData('text/plain')
      const lead = findLead(id ?? null)
      if (lead) void changeStage(lead, stage)
    })
  })
}
