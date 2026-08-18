import { api } from './api.js'
import { closeModal, openModal } from './modal.js'
import { findLead, isAdmin, removeEvent, removeLead, state, upsertEvent, upsertLead } from './store.js'
import type { CalendarEvent, Lead, Priority, Stage } from './types.js'
import {
  $,
  EVENT_KINDS,
  PRIORITIES,
  STAGES,
  escapeHtml,
  fromDateTimeInput,
  stageMeta,
  toDateInput,
  toDateTimeInput,
  toast,
} from './ui.js'

const option = (value: string, label: string, selected: boolean): string =>
  `<option value="${value}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`

/* ------------------------------------------------------------ lead form */

export function openLeadForm(lead?: Lead): void {
  const isEdit = Boolean(lead)
  const panel = openModal(`
    <form id="leadForm">
      <div class="panel-head">
        <div>
          <h2>${isEdit ? 'Modifier le lead' : 'Nouveau lead'}</h2>
          <p>${isEdit ? 'Mets à jour les informations de cette opportunité.' : 'Ajoute une opportunité au pipeline.'}</p>
        </div>
        <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>
      <div class="form-grid">
        <div class="field-group"><label for="f-company">Société</label>
          <input class="field" id="f-company" name="company" required value="${escapeHtml(lead?.company ?? '')}" placeholder="Acme Corp"></div>
        <div class="field-group"><label for="f-contact">Contact principal</label>
          <input class="field" id="f-contact" name="contact" value="${escapeHtml(lead?.contact ?? '')}" placeholder="Camille Durand"></div>
        <div class="field-group"><label for="f-role">Fonction</label>
          <input class="field" id="f-role" name="role" value="${escapeHtml(lead?.role ?? '')}" placeholder="Head of Ops"></div>
        <div class="field-group"><label for="f-owner">Responsable</label>
          ${
            isAdmin()
              ? `<select class="field" id="f-owner" name="owner_id">
                  ${state.members
                    .map((member) =>
                      option(
                        member.id,
                        member.full_name || member.email,
                        (lead?.owner_id ?? state.profile?.id ?? '') === member.id,
                      ),
                    )
                    .join('')}
                </select>`
              : `<input class="field" id="f-owner" value="${escapeHtml(
                  state.profile?.full_name || state.profile?.email || 'Moi',
                )}" disabled>`
          }</div>
        <div class="field-group"><label for="f-email">Email</label>
          <input class="field" id="f-email" name="email" type="email" value="${escapeHtml(lead?.email ?? '')}" placeholder="camille@acme.fr"></div>
        <div class="field-group"><label for="f-phone">Téléphone</label>
          <input class="field" id="f-phone" name="phone" value="${escapeHtml(lead?.phone ?? '')}" placeholder="+33 6 12 34 56 78"></div>
        <div class="field-group"><label for="f-stage">Étape</label>
          <select class="field" id="f-stage" name="stage">
            ${STAGES.map((item) => option(item.id, item.label, (lead?.stage ?? 'new') === item.id)).join('')}
          </select></div>
        <div class="field-group"><label for="f-priority">Priorité</label>
          <select class="field" id="f-priority" name="priority">
            ${(Object.keys(PRIORITIES) as Priority[])
              .map((key) => option(key, PRIORITIES[key].label, (lead?.priority ?? 'medium') === key))
              .join('')}
          </select></div>
        <div class="field-group"><label for="f-value">Valeur (€)</label>
          <input class="field" id="f-value" name="value" type="number" min="0" step="100" value="${lead?.value ?? 0}"></div>
        <div class="field-group"><label for="f-probability">Probabilité (%)</label>
          <input class="field" id="f-probability" name="probability" type="number" min="0" max="100" step="5" value="${lead?.probability ?? 10}"></div>
        <div class="field-group"><label for="f-source">Source</label>
          <input class="field" id="f-source" name="source" value="${escapeHtml(lead?.source ?? 'Direct')}" placeholder="Site web, référence…"></div>
        <div class="field-group"><label for="f-close">Clôture estimée</label>
          <input class="field" id="f-close" name="expectedCloseAt" type="date" value="${toDateInput(lead?.expectedCloseAt ?? '')}"></div>
        <div class="field-group full"><label for="f-next">Prochaine action</label>
          <input class="field" id="f-next" name="nextStep" value="${escapeHtml(lead?.nextStep ?? '')}" placeholder="Envoyer la proposition commerciale"></div>
        <div class="field-group full"><label for="f-tags">Tags (séparés par des virgules)</label>
          <input class="field" id="f-tags" name="tags" value="${escapeHtml((lead?.tags ?? []).join(', '))}" placeholder="SaaS, PME, urgent"></div>
        <div class="field-group full"><label for="f-notes">Notes</label>
          <textarea class="field" id="f-notes" name="notes" placeholder="Contexte, besoins, objections…">${escapeHtml(lead?.notes ?? '')}</textarea></div>
      </div>
      <div class="form-actions">
        ${isEdit ? '<button class="btn danger spacer" type="button" id="deleteLead"><i class="ri-delete-bin-line"></i>Supprimer</button>' : ''}
        <button class="btn" type="button" data-close-modal>Annuler</button>
        <button class="btn primary" type="submit"><i class="ri-check-line"></i>${isEdit ? 'Enregistrer' : 'Créer le lead'}</button>
      </div>
    </form>`)

  const form = $<HTMLFormElement>('#leadForm', panel)
  const stageSelect = $<HTMLSelectElement>('#f-stage', panel)
  const probabilityInput = $<HTMLInputElement>('#f-probability', panel)

  stageSelect.addEventListener('change', () => {
    probabilityInput.value = String(stageMeta(stageSelect.value as Stage).probability)
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const data = new FormData(form)
    const payload: Partial<Lead> = {
      contact: String(data.get('contact') ?? '').trim(),
      company: String(data.get('company') ?? '').trim(),
      role: String(data.get('role') ?? '').trim(),
      // Seul un admin peut réattribuer un lead ; sinon la propriété reste inchangée.
      ...(isAdmin() && data.get('owner_id') ? { owner_id: String(data.get('owner_id')) } : {}),
      email: String(data.get('email') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim(),
      source: String(data.get('source') ?? '').trim(),
      stage: (data.get('stage') as Stage) ?? 'new',
      priority: (data.get('priority') as Priority) ?? 'medium',
      value: Number(data.get('value') ?? 0),
      probability: Number(data.get('probability') ?? 0),
      nextStep: String(data.get('nextStep') ?? '').trim(),
      expectedCloseAt: String(data.get('expectedCloseAt') ?? ''),
      notes: String(data.get('notes') ?? ''),
      tags: String(data.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    }

    try {
      const saved = lead ? await api.updateLead(lead.id, payload) : await api.createLead(payload)
      upsertLead(saved)
      closeModal()
      toast(lead ? 'Lead mis à jour.' : 'Lead créé.')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })

  panel.querySelector('#deleteLead')?.addEventListener('click', async () => {
    if (!lead || !confirm(`Supprimer définitivement ${lead.contact} ?`)) return
    try {
      await api.deleteLead(lead.id)
      removeLead(lead.id)
      closeModal()
      toast('Lead supprimé.')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })
}

/* ----------------------------------------------------------- event form */

export function openEventForm(event?: CalendarEvent, defaults?: { start?: Date; leadId?: string }): void {
  const isEdit = Boolean(event)
  const start = event?.start ?? (defaults?.start ?? defaultStart()).toISOString()
  const end = event?.end ?? new Date(new Date(start).getTime() + 45 * 60_000).toISOString()
  const leadId = event?.leadId ?? defaults?.leadId ?? ''

  const panel = openModal(`
    <form id="eventForm">
      <div class="panel-head">
        <div>
          <h2>${isEdit ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</h2>
          <p>Relie ce créneau à un lead pour le retrouver dans son historique.</p>
        </div>
        <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>
      <div class="form-grid">
        <div class="field-group full"><label for="e-title">Titre</label>
          <input class="field" id="e-title" name="title" required value="${escapeHtml(event?.title ?? '')}" placeholder="Point de cadrage"></div>
        <div class="field-group"><label for="e-kind">Type</label>
          <select class="field" id="e-kind" name="kind">
            ${(Object.keys(EVENT_KINDS) as (keyof typeof EVENT_KINDS)[])
              .map((key) => option(key, EVENT_KINDS[key].label, (event?.kind ?? 'meeting') === key))
              .join('')}
          </select></div>
        <div class="field-group"><label for="e-lead">Lead associé</label>
          <select class="field" id="e-lead" name="leadId">
            <option value="">Aucun</option>
            ${state.leads
              .map((item) =>
                option(item.id, `${item.company || 'Sans société'}${item.contact ? ` (${item.contact})` : ''}`, leadId === item.id),
              )
              .join('')}
          </select></div>
        <div class="field-group"><label for="e-start">Début</label>
          <input class="field" id="e-start" name="start" type="datetime-local" required value="${toDateTimeInput(start)}"></div>
        <div class="field-group"><label for="e-end">Fin</label>
          <input class="field" id="e-end" name="end" type="datetime-local" required value="${toDateTimeInput(end)}"></div>
        <div class="field-group full"><label for="e-location">Lieu / lien</label>
          <input class="field" id="e-location" name="location" value="${escapeHtml(event?.location ?? '')}" placeholder="Visio, bureaux du client…"></div>
        <div class="field-group full"><label for="e-notes">Notes</label>
          <textarea class="field" id="e-notes" name="notes" placeholder="Objectif du rendez-vous, points à couvrir…">${escapeHtml(event?.notes ?? '')}</textarea></div>
      </div>
      <div class="form-actions">
        ${isEdit ? '<button class="btn danger spacer" type="button" id="deleteEvent"><i class="ri-delete-bin-line"></i>Supprimer</button>' : ''}
        ${isEdit ? `<button class="btn" type="button" id="toggleDone"><i class="ri-check-double-line"></i>${event?.done ? 'Rouvrir' : 'Marquer fait'}</button>` : ''}
        <button class="btn" type="button" data-close-modal>Annuler</button>
        <button class="btn primary" type="submit"><i class="ri-check-line"></i>${isEdit ? 'Enregistrer' : 'Planifier'}</button>
      </div>
    </form>`)

  const form = $<HTMLFormElement>('#eventForm', panel)
  const startInput = $<HTMLInputElement>('#e-start', panel)
  const endInput = $<HTMLInputElement>('#e-end', panel)

  startInput.addEventListener('change', () => {
    if (!startInput.value) return
    if (!endInput.value || new Date(endInput.value) <= new Date(startInput.value)) {
      endInput.value = toDateTimeInput(new Date(new Date(startInput.value).getTime() + 45 * 60_000).toISOString())
    }
  })

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault()
    const data = new FormData(form)
    const startValue = fromDateTimeInput(String(data.get('start') ?? ''))
    let endValue = fromDateTimeInput(String(data.get('end') ?? ''))
    if (!endValue || new Date(endValue) < new Date(startValue)) {
      endValue = new Date(new Date(startValue).getTime() + 45 * 60_000).toISOString()
    }
    const payload: Partial<CalendarEvent> = {
      title: String(data.get('title') ?? '').trim(),
      kind: data.get('kind') as CalendarEvent['kind'],
      start: startValue,
      end: endValue,
      leadId: String(data.get('leadId') ?? '') || null,
      location: String(data.get('location') ?? '').trim(),
      notes: String(data.get('notes') ?? ''),
    }

    try {
      const saved = event ? await api.updateEvent(event.id, payload) : await api.createEvent(payload)
      upsertEvent(saved)
      const linked = findLead(saved.leadId)
      if (linked && !event) {
        const updated = await api.addActivity(linked.id, {
          kind: 'meeting',
          text: `Rendez-vous planifié : ${saved.title}.`,
        })
        upsertLead(updated)
      }
      closeModal()
      toast(event ? 'Rendez-vous mis à jour.' : 'Rendez-vous planifié.')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })

  panel.querySelector('#toggleDone')?.addEventListener('click', async () => {
    if (!event) return
    try {
      upsertEvent(await api.updateEvent(event.id, { done: !event.done }))
      closeModal()
      toast(event.done ? 'Rendez-vous rouvert.' : 'Rendez-vous terminé.')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })

  panel.querySelector('#deleteEvent')?.addEventListener('click', async () => {
    if (!event || !confirm('Supprimer ce rendez-vous ?')) return
    try {
      await api.deleteEvent(event.id)
      removeEvent(event.id)
      closeModal()
      toast('Rendez-vous supprimé.')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })
}

function defaultStart(): Date {
  const date = new Date()
  date.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0)
  return date
}
