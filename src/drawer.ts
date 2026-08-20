import { api } from './api.js'
import { openEventForm, openLeadForm } from './forms.js'
import { closeDrawer, isDrawerOpen, openDrawer } from './modal.js'
import { findLead, state, subscribe, upsertLead } from './store.js'
import type { ActivityKind, Lead, Stage } from './types.js'
import {
  $,
  ACTIVITY_ICONS,
  EVENT_KINDS,
  PRIORITIES,
  STAGES,
  escapeHtml,
  emptyBlock,
  formatDate,
  formatDateTime,
  formatMoney,
  initials,
  relativeDays,
  stageMeta,
  toast,
  weightedValue,
} from './ui.js'

let openLeadId: string | null = null

export function openLeadDrawer(id: string): void {
  openLeadId = id
  renderDrawer()
}

export function initDrawer(): void {
  subscribe(() => {
    if (isDrawerOpen() && openLeadId) renderDrawer()
  })
}

function renderDrawer(): void {
  const lead = findLead(openLeadId)
  if (!lead) {
    openLeadId = null
    closeDrawer()
    return
  }

  const meta = stageMeta(lead.stage)
  const events = state.events
    .filter((event) => event.leadId === lead.id)
    .sort((a, b) => a.start.localeCompare(b.start))

  const panel = openDrawer(`
    <div class="panel-head">
      <div class="detail-hero">
        <span class="lead-avatar">${escapeHtml(initials(lead))}</span>
        <div>
          <h2>${escapeHtml(lead.company || 'Sans société')}</h2>
          <p>${escapeHtml([lead.contact, lead.role].filter(Boolean).join(' · ') || 'Aucun contact renseigné')}</p>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="icon-btn" type="button" id="editLead" aria-label="Modifier"><i class="ri-edit-line"></i></button>
        <button class="icon-btn" type="button" data-close-drawer aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>
    </div>

    <div class="stage-picker">
      ${STAGES.map(
        (item) => `
        <button class="stage-pick${item.id === lead.stage ? ' active' : ''}" type="button" data-stage="${item.id}"
          style="${item.id === lead.stage ? `background:${item.color};border-color:${item.color}` : ''}">
          ${escapeHtml(item.label)}
        </button>`,
      ).join('')}
    </div>

    <div class="price-hero" style="--price-color:${meta.color}">
      <div>
        <small>Montant de l'opportunité</small>
        <strong>${formatMoney(lead.value)}</strong>
      </div>
      <div class="price-weighted">
        <small>Pondéré à ${lead.probability} %</small>
        <b>${formatMoney(weightedValue(lead))}</b>
      </div>
    </div>

    <div class="detail-facts">
      <div class="fact"><small>Société</small><b>${escapeHtml(lead.company || '—')}</b></div>
      <div class="fact"><small>Contact</small><b>${escapeHtml(lead.contact || '—')}${lead.role ? ` (${escapeHtml(lead.role)})` : ''}</b></div>
      <div class="fact"><small>Clôture estimée</small><b>${lead.expectedCloseAt ? `${formatDate(lead.expectedCloseAt)}` : '—'}</b></div>
      <div class="fact"><small>Priorité</small><b>${PRIORITIES[lead.priority].label}</b></div>
      <div class="fact"><small>Email</small><b>${lead.email ? `<a href="mailto:${escapeHtml(lead.email)}" style="color:var(--blue);text-decoration:none">${escapeHtml(lead.email)}</a>` : '—'}</b></div>
      <div class="fact"><small>Téléphone</small><b>${escapeHtml(lead.phone || '—')}</b></div>
      <div class="fact"><small>Source</small><b>${escapeHtml(lead.source || '—')}</b></div>
      <div class="fact"><small>Responsable</small><b>${escapeHtml(lead.owner || '—')}</b></div>
    </div>

    ${
      lead.tags.length
        ? `<div class="lead-card-meta" style="margin-bottom:14px">${lead.tags
            .map((tag) => `<span class="chip muted">${escapeHtml(tag)}</span>`)
            .join('')}</div>`
        : ''
    }

    <div class="fact" style="background:color-mix(in srgb, ${meta.color} 10%, var(--surface))">
      <small>Prochaine action</small>
      <b>${escapeHtml(lead.nextStep || 'Aucune action définie.')}</b>
    </div>

    ${lead.notes ? `<p class="section-title">Notes</p><div class="fact"><b style="font-weight:500;line-height:1.7">${escapeHtml(lead.notes).replace(/\n/g, '<br>')}</b></div>` : ''}

    <p class="section-title">Rendez-vous</p>
    <button class="btn" type="button" id="planEvent" style="margin-bottom:10px"><i class="ri-calendar-line"></i>Planifier un rendez-vous</button>
    ${
      events.length
        ? `<div class="activity-list">${events
            .map((event) => {
              const kind = EVENT_KINDS[event.kind]
              return `
              <button class="agenda-item" type="button" data-event="${event.id}">
                <span class="agenda-time">${formatDateTime(event.start)}</span>
                <span><b>${escapeHtml(event.title)}</b><span>${kind.label}${event.location ? ` · ${escapeHtml(event.location)}` : ''}</span></span>
                <span class="chip ${event.done ? 'green' : 'muted'}">${event.done ? 'fait' : relativeDays(event.start)}</span>
              </button>`
            })
            .join('')}</div>`
        : emptyBlock('ri-calendar-line', 'Aucun rendez-vous', 'Planifie un créneau pour avancer sur ce lead.')
    }

    <p class="section-title">Historique</p>
    <form class="activity-form" id="activityForm">
      <select class="field" id="activityKind" style="width:110px">
        <option value="note">Note</option>
        <option value="call">Appel</option>
        <option value="email">Email</option>
        <option value="meeting">Réunion</option>
      </select>
      <input class="field" id="activityText" placeholder="Ajouter une entrée à l'historique…" required>
      <button class="btn primary" type="submit"><i class="ri-add-line"></i></button>
    </form>
    <div class="activity-list">
      ${
        lead.activities.length
          ? lead.activities
              .map(
                (activity) => `
          <article class="activity">
            <i class="${ACTIVITY_ICONS[activity.kind]}"></i>
            <div><p>${escapeHtml(activity.text)}</p><time>${formatDateTime(activity.createdAt)}</time></div>
          </article>`,
              )
              .join('')
          : emptyBlock('ri-history-line', 'Historique vide', 'Les changements d’étape et tes notes apparaîtront ici.')
      }
    </div>`)

  panel.querySelector('#editLead')?.addEventListener('click', () => openLeadForm(lead))
  panel.querySelector('#planEvent')?.addEventListener('click', () =>
    openEventForm(undefined, { leadId: lead.id }),
  )

  panel.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((button) => {
    button.addEventListener('click', () => changeStage(lead, button.dataset.stage as Stage))
  })

  panel.querySelectorAll<HTMLButtonElement>('[data-event]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = state.events.find((item) => item.id === button.dataset.event)
      if (target) openEventForm(target)
    })
  })

  const activityForm = panel.querySelector<HTMLFormElement>('#activityForm')
  activityForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const kind = $<HTMLSelectElement>('#activityKind', panel).value as ActivityKind
    const input = $<HTMLInputElement>('#activityText', panel)
    const text = input.value.trim()
    if (!text) return
    try {
      upsertLead(await api.addActivity(lead.id, { kind, text }))
      toast('Historique mis à jour.')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })
}

export async function changeStage(lead: Lead, stage: Stage): Promise<void> {
  if (lead.stage === stage) return
  try {
    upsertLead(await api.updateLead(lead.id, { stage, probability: stageMeta(stage).probability }))
    toast(`${lead.contact} → ${stageMeta(stage).label}.`)
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}
