import { api } from './api.js'
import { syncMeetingToPipeline } from './leadFromCall.js'
import { closeModal, openModal } from './modal.js'
import {
  findLead,
  isAdmin,
  removeCall,
  removeEvent,
  removeLead,
  state,
  upsertCall,
  upsertEvent,
  upsertLead,
} from './store.js'
import type { CalendarEvent, Call, CallObjection, CallOutcome, CallReason, Lead, Offer, Priority, Stage } from './types.js'
import {
  $,
  CALL_OBJECTIONS,
  CALL_OUTCOMES,
  CALL_REASONS,
  EVENT_KINDS,
  OFFERS,
  PRIORITIES,
  STAGES,
  escapeHtml,
  fromDateTimeInput,
  stageMeta,
  toDateInput,
  toDateTimeInput,
  toast,
  todayKey,
} from './ui.js'

/** Prospects déjà enregistrés, proposés à la saisie pour éviter les doublons. */
const suggestionsSocietes = (): string => {
  const noms = [...new Set(state.leads.map((lead) => lead.company.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  )
  return `<datalist id="societesConnues">${noms
    .map((nom) => `<option value="${escapeHtml(nom)}"></option>`)
    .join('')}</datalist>`
}

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
          <input class="field" id="f-company" name="company" required list="societesConnues" autocomplete="off"
            value="${escapeHtml(lead?.company ?? '')}" placeholder="Commence à taper : Certus, GSS…">
          ${suggestionsSocietes()}</div>
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
        <div class="field-group"><label for="f-offer">Type d'offre</label>
          <select class="field" id="f-offer" name="offer">
            ${(Object.keys(OFFERS) as Offer[])
              .map((key) => option(key, OFFERS[key].label, (lead?.offer ?? '') === key))
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
  const companyInput = $<HTMLInputElement>('#f-company', panel)

  // Reprendre les coordonnées connues du prospect évite de les ressaisir, sans
  // jamais écraser ce qui vient d'être tapé.
  if (!isEdit) {
    companyInput.addEventListener('change', () => {
      const connu = state.leads.find(
        (item) => item.company.trim().toLowerCase() === companyInput.value.trim().toLowerCase(),
      )
      if (!connu) return
      const reprendre = (id: string, valeur: string) => {
        const champ = panel.querySelector<HTMLInputElement>(id)
        if (champ && !champ.value.trim() && valeur) champ.value = valeur
      }
      reprendre('#f-contact', connu.contact)
      reprendre('#f-role', connu.role)
      reprendre('#f-email', connu.email)
      reprendre('#f-phone', connu.phone)
      const offre = panel.querySelector<HTMLSelectElement>('#f-offer')
      if (offre && !offre.value && connu.offer) offre.value = connu.offer
      toast(`Coordonnées reprises de ${connu.company}.`)
    })
  }

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
      offer: (data.get('offer') as Offer) ?? '',
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

/* ------------------------------------------------------------ appel form */

/**
 * Fiche d'appel complète. La saisie rapide se fait directement dans le tableau
 * du suivi ; ce formulaire sert à compléter le détail — objection entendue,
 * notes, prochaine action — et à corriger une ligne existante.
 */
export function openCallForm(call?: Call, defaults?: Partial<Call>): void {
  const isEdit = Boolean(call)
  const base: Partial<Call> = call ?? { date: todayKey(), outcome: 'no-answer', ...defaults }

  const panel = openModal(`
    <form id="callForm">
      <div class="panel-head">
        <div>
          <h2>${isEdit ? "Modifier l'appel" : 'Enregistrer un appel'}</h2>
          <p>Un appel par ligne : le suivi calcule ensuite les taux de réponse et de rendez-vous.</p>
        </div>
        <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>
      <div class="form-grid">
        <div class="field-group"><label for="c-date">Date de l'appel</label>
          <input class="field" id="c-date" name="date" type="date" required value="${escapeHtml(base.date ?? todayKey())}"></div>
        <div class="field-group"><label for="c-company">Entreprise</label>
          <input class="field" id="c-company" name="company" list="societesConnues" autocomplete="off"
            value="${escapeHtml(base.company ?? '')}" placeholder="Certus, GSS…">
          ${suggestionsSocietes()}</div>
        <div class="field-group"><label for="c-contact">Nom du contact</label>
          <input class="field" id="c-contact" name="contact" value="${escapeHtml(base.contact ?? '')}" placeholder="Camille Durand"></div>
        <div class="field-group"><label for="c-phone">Numéro de téléphone</label>
          <input class="field" id="c-phone" name="phone" value="${escapeHtml(base.phone ?? '')}" placeholder="+33 6 12 34 56 78"></div>
        <div class="field-group"><label for="c-outcome">Résultat de l'appel</label>
          <select class="field" id="c-outcome" name="outcome">
            ${(Object.keys(CALL_OUTCOMES) as CallOutcome[])
              .map((key) => option(key, CALL_OUTCOMES[key].label, (base.outcome ?? 'no-answer') === key))
              .join('')}
          </select></div>
        <div class="field-group"><label for="c-lead">Lead associé</label>
          <select class="field" id="c-lead" name="leadId">
            <option value="">Aucun</option>
            ${state.leads
              .map((item) =>
                option(
                  item.id,
                  `${item.company || 'Sans société'}${item.contact ? ` (${item.contact})` : ''}`,
                  (base.leadId ?? '') === item.id,
                ),
              )
              .join('')}
          </select></div>
        <div class="field-group full">
          <div class="toggle-row">
            <label class="toggle"><input type="checkbox" id="c-conversation" name="conversation"${base.conversation ? ' checked' : ''}>
              <span><b>Conversation engagée</b><small>Le prospect a réellement échangé avec toi.</small></span></label>
            <label class="toggle"><input type="checkbox" id="c-meeting" name="meeting"${base.meeting ? ' checked' : ''}>
              <span><b>Rendez-vous pris</b><small>L'appel débouche sur un créneau.</small></span></label>
          </div>
        </div>
        <div class="field-group" id="c-meeting-field"><label for="c-meetingAt">Date du rendez-vous</label>
          <input class="field" id="c-meetingAt" name="meetingAt" type="date" value="${escapeHtml(base.meetingAt ?? '')}"></div>
        <div class="field-group" id="c-reason-field"><label for="c-reason">Si pas de rendez-vous : raison</label>
          <select class="field" id="c-reason" name="reason">
            ${(Object.keys(CALL_REASONS) as CallReason[])
              .map((key) => option(key, CALL_REASONS[key], (base.reason ?? '') === key))
              .join('')}
          </select></div>
        <div class="field-group"><label for="c-objection">Objection principale</label>
          <select class="field" id="c-objection" name="objection">
            ${(Object.keys(CALL_OBJECTIONS) as CallObjection[])
              .map((key) => option(key, CALL_OBJECTIONS[key], (base.objection ?? '') === key))
              .join('')}
          </select></div>
        <div class="field-group"><label for="c-followUpAt">Date de relance</label>
          <input class="field" id="c-followUpAt" name="followUpAt" type="date" value="${escapeHtml(base.followUpAt ?? '')}"></div>
        <div class="field-group full"><label for="c-nextAction">Prochaine action</label>
          <input class="field" id="c-nextAction" name="nextAction" value="${escapeHtml(base.nextAction ?? '')}" placeholder="Rappeler après la réunion budget"></div>
        <div class="field-group full"><label for="c-notes">Notes d'appel</label>
          <textarea class="field" id="c-notes" name="notes" placeholder="Contexte, interlocuteur, ce qui a été dit…">${escapeHtml(base.notes ?? '')}</textarea></div>
      </div>
      <div class="form-actions">
        ${isEdit ? '<button class="btn danger spacer" type="button" id="deleteCall"><i class="ri-delete-bin-line"></i>Supprimer</button>' : ''}
        <button class="btn" type="button" data-close-modal>Annuler</button>
        <button class="btn primary" type="submit"><i class="ri-check-line"></i>${isEdit ? 'Enregistrer' : "Enregistrer l'appel"}</button>
      </div>
    </form>`)

  const form = $<HTMLFormElement>('#callForm', panel)
  const outcome = $<HTMLSelectElement>('#c-outcome', panel)
  const conversation = $<HTMLInputElement>('#c-conversation', panel)
  const meeting = $<HTMLInputElement>('#c-meeting', panel)

  // Les trois champs se répondent : sans réponse il n'y a pas de conversation,
  // et un rendez-vous obtenu rend la « raison de refus » sans objet.
  const syncDependencies = (): void => {
    if (outcome.value !== 'answered') {
      conversation.checked = false
      meeting.checked = false
    }
    conversation.disabled = outcome.value !== 'answered'
    meeting.disabled = !conversation.checked
    if (!conversation.checked) meeting.checked = false
    $('#c-meeting-field', panel).hidden = !meeting.checked
    $('#c-reason-field', panel).hidden = meeting.checked
  }

  outcome.addEventListener('change', () => {
    // Une réponse implique presque toujours un échange : on le pré-coche.
    if (outcome.value === 'answered' && !conversation.checked) conversation.checked = true
    syncDependencies()
  })
  conversation.addEventListener('change', syncDependencies)
  meeting.addEventListener('change', syncDependencies)
  syncDependencies()

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const data = new FormData(form)
    const gotMeeting = meeting.checked
    const payload: Partial<Call> = {
      date: String(data.get('date') ?? '') || todayKey(),
      contact: String(data.get('contact') ?? '').trim(),
      company: String(data.get('company') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim(),
      outcome: (data.get('outcome') as CallOutcome) ?? 'no-answer',
      conversation: conversation.checked,
      meeting: gotMeeting,
      meetingAt: gotMeeting ? String(data.get('meetingAt') ?? '') : '',
      reason: gotMeeting ? '' : ((data.get('reason') as CallReason) ?? ''),
      objection: (data.get('objection') as CallObjection) ?? '',
      notes: String(data.get('notes') ?? ''),
      nextAction: String(data.get('nextAction') ?? '').trim(),
      followUpAt: String(data.get('followUpAt') ?? ''),
      leadId: String(data.get('leadId') ?? '') || null,
    }

    try {
      const saved = call ? await api.updateCall(call.id, payload) : await api.createCall(payload)
      upsertCall(saved)

      if (saved.meeting && !call?.meeting) {
        // Un rendez-vous obtenu place l'opportunité en « Qualifié » dans le
        // pipeline et consigne lui-même l'événement dans son historique.
        await syncMeetingToPipeline(saved)
      } else {
        // Sinon l'appel enrichit simplement l'historique du lead déjà relié.
        const linked = findLead(saved.leadId)
        if (linked && !call) {
          upsertLead(
            await api.addActivity(linked.id, {
              kind: 'call',
              text: `Appel : ${CALL_OUTCOMES[saved.outcome].label}.`,
            }),
          )
        }
      }
      closeModal()
      toast(call ? 'Appel mis à jour.' : 'Appel enregistré.')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })

  panel.querySelector('#deleteCall')?.addEventListener('click', async () => {
    if (!call || !confirm('Supprimer définitivement cet appel ?')) return
    try {
      await api.deleteCall(call.id)
      removeCall(call.id)
      closeModal()
      toast('Appel supprimé.')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })
}
