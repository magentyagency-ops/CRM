import { api } from '../api.js'
import { openLeadDrawer } from '../drawer.js'
import { openEventForm, openLeadForm } from '../forms.js'
import { removeLead, state, subscribe } from '../store.js'
import type { Lead } from '../types.js'
import {
  $,
  PRIORITIES,
  STAGES,
  emptyBlock,
  escapeHtml,
  formatDate,
  formatMoney,
  initials,
  relativeDays,
  stageMeta,
  toast,
  viewIsActive,
} from '../ui.js'
import { matchesSearch } from './pipeline.js'

type SortKey = 'contact' | 'company' | 'stage' | 'value' | 'probability' | 'expectedCloseAt' | 'updatedAt'

let search = ''
let stageFilter = 'all'
let sortKey: SortKey = 'updatedAt'
let sortAsc = false

export function initLeads(): void {
  const searchInput = $<HTMLInputElement>('#leadSearch')
  const stageSelect = $<HTMLSelectElement>('#leadStageFilter')

  stageSelect.innerHTML = [
    '<option value="all">Toutes les étapes</option>',
    ...STAGES.map((stage) => `<option value="${stage.id}">${stage.label}</option>`),
  ].join('')

  searchInput.addEventListener('input', () => {
    search = searchInput.value.trim().toLowerCase()
    render()
  })

  stageSelect.addEventListener('change', () => {
    stageFilter = stageSelect.value
    render()
  })

  $('#leadTable').querySelectorAll<HTMLElement>('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort as SortKey
      if (key === sortKey) sortAsc = !sortAsc
      else {
        sortKey = key
        sortAsc = key === 'contact' || key === 'company'
      }
      render()
    })
  })

  subscribe(render)
  render()
}

function compare(a: Lead, b: Lead): number {
  const direction = sortAsc ? 1 : -1
  switch (sortKey) {
    case 'value':
      return (a.value - b.value) * direction
    case 'probability':
      return (a.probability - b.probability) * direction
    case 'stage':
      return (STAGES.findIndex((s) => s.id === a.stage) - STAGES.findIndex((s) => s.id === b.stage)) * direction
    default:
      return String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')) * direction
  }
}

function render(): void {
  if (!viewIsActive('leads')) return
  const body = $('#leadTableBody')
  const empty = $('#leadTableEmpty')

  const rows = state.leads
    .filter((lead) => (stageFilter === 'all' ? true : lead.stage === stageFilter))
    .filter((lead) => matchesSearch(lead, search))
    .sort(compare)

  body.innerHTML = rows
    .map((lead) => {
      const meta = stageMeta(lead.stage)
      const priority = PRIORITIES[lead.priority]
      return `
        <tr data-lead="${lead.id}">
          <td>
            <div class="cell-name">
              <span class="lead-avatar">${escapeHtml(initials(lead))}</span>
              <div>
                <b>${escapeHtml(lead.company || 'Sans société')}</b>
                <span class="muted" style="font-size:9px">${escapeHtml(lead.role || 'Société')}</span>
              </div>
            </div>
          </td>
          <td>
            <b>${escapeHtml(lead.contact || '—')}</b>
            <br><span class="muted" style="font-size:9px">${escapeHtml(lead.email || lead.phone || '—')}</span>
          </td>
          <td><span class="chip" style="background:color-mix(in srgb, ${meta.color} 14%, var(--surface));color:${meta.color}">${meta.label}</span></td>
          <td class="num price">${formatMoney(lead.value)}</td>
          <td class="num">${lead.probability} %</td>
          <td class="num">${lead.expectedCloseAt ? formatDate(lead.expectedCloseAt) : '—'}</td>
          <td><span class="muted" style="font-size:10px">${relativeDays(lead.updatedAt)}</span> <span class="chip ${priority.chip}">${priority.label}</span></td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" type="button" data-act="event" title="Planifier"><i class="ri-calendar-line"></i></button>
              <button class="icon-btn" type="button" data-act="edit" title="Modifier"><i class="ri-edit-line"></i></button>
              <button class="icon-btn" type="button" data-act="delete" title="Supprimer"><i class="ri-delete-bin-line"></i></button>
            </div>
          </td>
        </tr>`
    })
    .join('')

  empty.innerHTML = rows.length
    ? ''
    : emptyBlock(
        'ri-contacts-book-3-line',
        state.leads.length ? 'Aucun résultat' : 'Aucun lead',
        state.leads.length
          ? 'Modifie ta recherche ou le filtre d’étape.'
          : 'Crée ton premier lead pour alimenter le pipeline.',
      )

  body.querySelectorAll<HTMLElement>('tr[data-lead]').forEach((row) => {
    const lead = state.leads.find((item) => item.id === row.dataset.lead)
    if (!lead) return

    row.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act
      if (!action) {
        openLeadDrawer(lead.id)
        return
      }
      event.stopPropagation()
      if (action === 'edit') openLeadForm(lead)
      if (action === 'event') openEventForm(undefined, { leadId: lead.id })
      if (action === 'delete') void deleteLead(lead)
    })
  })
}

async function deleteLead(lead: Lead): Promise<void> {
  if (!confirm(`Supprimer définitivement ${lead.contact} ?`)) return
  try {
    await api.deleteLead(lead.id)
    removeLead(lead.id)
    toast('Lead supprimé.')
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}
