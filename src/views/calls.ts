import { api } from '../api.js'
import { openCallForm } from '../forms.js'
import { syncMeetingToPipeline } from '../leadFromCall.js'
import { enhanceSelects, refreshSelects } from '../select.js'
import { isAdmin, memberName, removeCall, state, subscribe, upsertCall } from '../store.js'
import type { Call, CallObjection, CallOutcome, CallReason } from '../types.js'
import {
  $,
  $$,
  CALL_OBJECTIONS,
  CALL_OUTCOMES,
  CALL_REASONS,
  emptyBlock,
  escapeHtml,
  formatDayShort,
  todayKey,
  toast,
  viewIsActive,
} from '../ui.js'

/** Fenêtres d'analyse proposées au-dessus du tableau. */
const PERIODS = [
  { id: 'today', label: "Aujourd'hui", days: 1 },
  { id: 'week', label: '7 jours', days: 7 },
  { id: 'month', label: '30 jours', days: 30 },
  { id: 'all', label: 'Tout', days: 0 },
] as const

type PeriodId = (typeof PERIODS)[number]['id']

/** Les treize colonnes du classeur de suivi, dans son ordre de saisie. */
const FIELDS = [
  'date',
  'contact',
  'company',
  'phone',
  'outcome',
  'conversation',
  'meeting',
  'meetingAt',
  'reason',
  'objection',
  'notes',
  'nextAction',
  'followUpAt',
] as const

type Field = (typeof FIELDS)[number]

let search = ''
let period: PeriodId = 'week'
let outcomeFilter: 'all' | CallOutcome = 'all'
let ownerFilter = 'all'

/** Cellule en cours d'édition : le rendu s'interrompt tant qu'elle est ouverte. */
let editing: { id: string; field: Field } | null = null

export function initCalls(): void {
  const searchInput = $<HTMLInputElement>('#callSearch')
  searchInput.addEventListener('input', () => {
    search = searchInput.value.trim().toLowerCase()
    render()
  })

  const outcomeSelect = $<HTMLSelectElement>('#callOutcomeFilter')
  outcomeSelect.innerHTML = [
    '<option value="all">Tous les résultats</option>',
    ...(Object.keys(CALL_OUTCOMES) as CallOutcome[]).map(
      (key) => `<option value="${key}">${CALL_OUTCOMES[key].label}</option>`,
    ),
  ].join('')
  enhanceSelects(outcomeSelect.parentElement ?? document)
  outcomeSelect.addEventListener('change', () => {
    outcomeFilter = outcomeSelect.value as typeof outcomeFilter
    render()
  })

  $('#callOwnerFilter').addEventListener('change', (event) => {
    ownerFilter = (event.target as HTMLSelectElement).value
    render()
  })

  const modes = $('#callPeriods')
  modes.innerHTML = PERIODS.map(
    (item) => `<button class="seg${item.id === period ? ' active' : ''}" data-period="${item.id}">${item.label}</button>`,
  ).join('')
  modes.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-period]')
    if (!button) return
    period = button.dataset.period as PeriodId
    $$('.seg', modes).forEach((seg) => seg.classList.toggle('active', seg === button))
    render()
  })

  initQuickRow()
  subscribe(render)
  render()
}

/* -------------------------------------------------------------- filtrage */

/** Borne basse de la période, ou null quand tout l'historique est demandé. */
function periodStart(): string | null {
  const days = PERIODS.find((item) => item.id === period)?.days ?? 0
  if (!days) return null
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return todayKey(from)
}

const matchesCallSearch = (call: Call): boolean =>
  !search ||
  [call.company, call.contact, call.phone, call.notes, call.nextAction]
    .join(' ')
    .toLowerCase()
    .includes(search)

/** Appels visibles selon le compte sélectionné, avant filtres de la barre d'outils. */
const ownerScope = (): Call[] =>
  state.calls.filter((call) => ownerFilter === 'all' || (call.owner_id ?? '') === ownerFilter)

function visibleCalls(): Call[] {
  const from = periodStart()
  return ownerScope()
    .filter((call) => (from ? call.date >= from : true))
    .filter((call) => (outcomeFilter === 'all' ? true : call.outcome === outcomeFilter))
    .filter(matchesCallSearch)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

/* ------------------------------------------------- éditeurs de cellule */

const option = (value: string, label: string, selected: boolean): string =>
  `<option value="${value}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`

const OUI_NON = (value: boolean): string =>
  `${option('non', 'Non', !value)}${option('oui', 'Oui', value)}`

/**
 * Champ de saisie d'une colonne. Le même code sert à la ligne d'ajout et à
 * l'édition en ligne : les listes déroulantes ne peuvent pas diverger.
 */
function editor(field: Field, call?: Partial<Call>, id = ''): string {
  const attr = id ? ` id="${id}"` : ''
  const base = `class="field cell-input"${attr} data-field="${field}"`
  switch (field) {
    case 'date':
    case 'meetingAt':
    case 'followUpAt':
      return `<input ${base} type="date" value="${escapeHtml(call?.[field] ?? '')}" aria-label="${LABELS[field]}">`
    case 'outcome':
      return `<select ${base} aria-label="${LABELS[field]}">${(Object.keys(CALL_OUTCOMES) as CallOutcome[])
        .map((key) => option(key, CALL_OUTCOMES[key].label, (call?.outcome ?? 'no-answer') === key))
        .join('')}</select>`
    case 'conversation':
    case 'meeting':
      return `<select ${base} aria-label="${LABELS[field]}">${OUI_NON(Boolean(call?.[field]))}</select>`
    case 'reason':
      return `<select ${base} aria-label="${LABELS[field]}">${(Object.keys(CALL_REASONS) as CallReason[])
        .map((key) => option(key, CALL_REASONS[key], (call?.reason ?? '') === key))
        .join('')}</select>`
    case 'objection':
      return `<select ${base} aria-label="${LABELS[field]}">${(Object.keys(CALL_OBJECTIONS) as CallObjection[])
        .map((key) => option(key, CALL_OBJECTIONS[key], (call?.objection ?? '') === key))
        .join('')}</select>`
    default:
      return `<input ${base} type="text" value="${escapeHtml(String(call?.[field] ?? ''))}"
        placeholder="${PLACEHOLDERS[field] ?? ''}" aria-label="${LABELS[field]}">`
  }
}

const LABELS: Record<Field, string> = {
  date: "Date de l'appel",
  contact: 'Nom du contact',
  company: 'Entreprise',
  phone: 'Numéro de téléphone',
  outcome: "Résultat de l'appel",
  conversation: 'Conversation engagée',
  meeting: 'Rendez-vous pris',
  meetingAt: 'Date du rendez-vous',
  reason: 'Raison en cas de refus',
  objection: 'Objection entendue',
  notes: "Notes d'appel",
  nextAction: 'Prochaine action',
  followUpAt: 'Date de relance',
}

const PLACEHOLDERS: Partial<Record<Field, string>> = {
  contact: 'Camille Durand',
  company: 'Certus',
  phone: '+33 6 12 34 56 78',
  notes: 'Ce qui a été dit…',
  nextAction: 'Envoyer la proposition',
}

/** Valeur typée lue dans un champ de saisie. */
function readEditor(node: HTMLInputElement | HTMLSelectElement, field: Field): Partial<Call> {
  if (field === 'conversation' || field === 'meeting') return { [field]: node.value === 'oui' }
  return { [field]: node.value.trim() } as Partial<Call>
}

/**
 * Cohérence des colonnes liées, telle qu'elle était tenue à la main dans le
 * classeur. Deux sens de lecture, dans cet ordre : renseigner une colonne
 * engageante entraîne celles dont elle dépend — on ne prend pas rendez-vous
 * sans avoir parlé à quelqu'un — et à l'inverse, retirer une colonne annule
 * celles qui en dépendaient.
 */
function coherent(call: Partial<Call>, patch: Partial<Call>): Partial<Call> {
  const next = { ...call, ...patch }

  if (patch.meeting === true) {
    next.conversation = true
    next.outcome = 'answered'
    // Un rendez-vous obtenu rend la raison de refus sans objet.
    next.reason = ''
  } else if (patch.conversation === true) {
    next.outcome = 'answered'
  }

  if (next.outcome !== 'answered') next.conversation = false
  if (!next.conversation) next.meeting = false
  if (!next.meeting) next.meetingAt = ''

  // Seules les colonnes réellement déplacées sont renvoyées : corriger une note
  // ne doit pas réécrire le résultat de l'appel au passage.
  const normalise: Partial<Call> = {
    outcome: next.outcome ?? 'no-answer',
    conversation: Boolean(next.conversation),
    meeting: Boolean(next.meeting),
    meetingAt: next.meetingAt ?? '',
    reason: next.reason ?? '',
  }
  const result: Partial<Call> = { ...patch }
  ;(Object.keys(normalise) as (keyof typeof normalise)[]).forEach((key) => {
    if (call[key] !== normalise[key]) Object.assign(result, { [key]: normalise[key] })
  })
  return result
}

/* ------------------------------------------------------- saisie rapide */

/**
 * La ligne d'ajout reprend les treize colonnes : on remplit ce qu'on sait au
 * moment de l'appel, on valide avec Entrée, et la ligne se vide pour le suivant.
 */
function initQuickRow(): void {
  const row = $('#callQuickRow')

  row.innerHTML = `
    ${FIELDS.map((field) => `<td class="col-${field}">${editor(field, { date: todayKey() }, `quick-${field}`)}</td>`).join('')}
    <td class="admin-col col-owner" hidden></td>
    <td class="col-actions">
      <button class="btn primary" type="button" id="quickAdd" title="Enregistrer l'appel (Entrée)">
        <i class="ri-add-line"></i>Ajouter
      </button>
    </td>`

  row.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Enter') return
    event.preventDefault()
    void submitQuickRow()
  })

  enhanceSelects(row)
  // Les colonnes dépendantes se grisent comme dans la fiche complète.
  row.addEventListener('change', syncQuickRow)
  syncQuickRow()

  $('#quickAdd', row).addEventListener('click', () => void submitQuickRow())
}

const quickField = <T extends HTMLInputElement | HTMLSelectElement>(field: Field): T =>
  $<T>(`#quick-${field}`, $('#callQuickRow'))

/** Reflet visuel des dépendances entre colonnes pendant la saisie. */
function syncQuickRow(): void {
  const outcome = quickField<HTMLSelectElement>('outcome').value
  const conversation = quickField<HTMLSelectElement>('conversation')
  const meeting = quickField<HTMLSelectElement>('meeting')

  if (outcome !== 'answered') conversation.value = 'non'
  conversation.disabled = outcome !== 'answered'
  if (conversation.value !== 'oui') meeting.value = 'non'
  meeting.disabled = conversation.value !== 'oui'

  const hasMeeting = meeting.value === 'oui'
  quickField('meetingAt').disabled = !hasMeeting
  quickField('reason').disabled = hasMeeting
  // Les valeurs viennent d'être posées par le code : les boutons doivent suivre.
  refreshSelects($('#callQuickRow'))
}

async function submitQuickRow(): Promise<void> {
  const values = FIELDS.reduce<Partial<Call>>(
    (acc, field) => Object.assign(acc, readEditor(quickField(field), field)),
    {},
  )

  if (!values.company && !values.contact) {
    toast('Renseigne au moins une entreprise ou un contact.', 'error')
    quickField('company').focus()
    return
  }

  const button = $<HTMLButtonElement>('#quickAdd')
  button.disabled = true

  try {
    const saved = await api.createCall({ ...values, ...coherent({}, values) })
    upsertCall(saved)

    // La ligne se vide tout de suite : le commercial enchaîne pendant que le
    // pipeline se met à jour. La date reste, on est dans la même session.
    FIELDS.filter((field) => field !== 'date' && field !== 'outcome').forEach((field) => {
      const node = quickField(field)
      node.value = node.tagName === 'SELECT' ? (node as HTMLSelectElement).options[0].value : ''
    })
    quickField('outcome').value = 'no-answer'
    syncQuickRow()
    quickField('contact').focus()
    toast('Appel enregistré.')

    // Un rendez-vous décroché part directement en opportunité qualifiée.
    if (saved.meeting) await syncMeetingToPipeline(saved)
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    button.disabled = false
  }
}

/* ------------------------------------------------------ édition en ligne */

/** Ouvre une cellule à l'édition, avec le champ correspondant à sa colonne. */
function startEdit(cell: HTMLElement, call: Call): void {
  if (cell.classList.contains('editing')) return
  const field = cell.dataset.field as Field
  editing = { id: call.id, field }
  cell.classList.add('editing')
  cell.innerHTML = editor(field, call)

  const input = cell.querySelector<HTMLInputElement | HTMLSelectElement>('.cell-input')
  if (!input) return
  if (input instanceof HTMLSelectElement) {
    enhanceSelects(cell)
    cell.querySelector<HTMLButtonElement>('.select-btn')?.click()
  } else {
    input.focus()
    input.select()
  }

  let settled = false
  const finish = async (commit: boolean): Promise<void> => {
    if (settled) return
    settled = true
    editing = null
    document.removeEventListener('mousedown', dehors)
    const patch = readEditor(input, field)
    if (!commit) {
      render()
      return
    }
    await saveCell(call, patch)
  }

  /**
   * Un champ masqué ne perd jamais le focus : sans ce garde-fou, cliquer
   * ailleurs laisserait la cellule ouverte et figerait le tableau, qui ne se
   * redessine pas pendant une saisie.
   */
  function dehors(event: MouseEvent): void {
    const cible = event.target as HTMLElement
    if (cell.contains(cible) || cible.closest('.select-menu')) return
    void finish(true)
  }
  document.addEventListener('mousedown', dehors)

  // `input` est une union input/select : on écoute sur l'élément générique.
  // Une liste déroulante se valide dès le choix : pas de validation en plus.
  input.addEventListener('change', () => void finish(true))

  cell.addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key
    if (key !== 'Enter' && key !== 'Escape') return
    event.preventDefault()
    void finish(key === 'Enter')
  })
  input.addEventListener('blur', () => void finish(true))
}

async function saveCell(call: Call, patch: Partial<Call>): Promise<void> {
  const field = Object.keys(patch)[0] as Field
  if (String(call[field] ?? '') === String(patch[field] ?? '')) {
    render()
    return
  }

  try {
    const saved = await api.updateCall(call.id, coherent(call, patch))
    upsertCall(saved)
    // Le rendez-vous vient d'être coché : le pipeline doit s'en apercevoir.
    if (saved.meeting && !call.meeting) await syncMeetingToPipeline(saved)
  } catch (error) {
    toast((error as Error).message, 'error')
    render()
  }
}

/* --------------------------------------------------------------- rendu */

function render(): void {
  if (!viewIsActive('calls')) return
  renderCompanySuggestions()
  renderOwnerFilter()
  const calls = visibleCalls()
  renderMetrics(calls)
  renderTable(calls)
  renderInsights(calls)
}

/** Entreprises déjà appelées ou déjà au pipeline, proposées à la saisie rapide. */
function renderCompanySuggestions(): void {
  const noms = [
    ...new Set(
      [...state.calls.map((call) => call.company), ...state.leads.map((lead) => lead.company)]
        .map((nom) => nom.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'fr'))

  $('#callCompanies').innerHTML = noms.map((nom) => `<option value="${escapeHtml(nom)}"></option>`).join('')
  quickField('company').setAttribute('list', 'callCompanies')
}

function renderOwnerFilter(): void {
  // C'est l'enveloppe qui se masque : le select est habillé par un bouton.
  $('#callOwnerSlot').hidden = !isAdmin()
  if (!isAdmin()) return
  const select = $<HTMLSelectElement>('#callOwnerFilter')

  const previous = ownerFilter
  select.innerHTML = [
    '<option value="all">Tous les appelants</option>',
    ...state.members.map((member) => {
      const count = state.calls.filter((call) => call.owner_id === member.id).length
      return `<option value="${member.id}">${escapeHtml(member.full_name || member.email.split('@')[0])} (${count})</option>`
    }),
  ].join('')
  // Un compte désactivé disparaît de la liste : le filtre retombe sur « tous ».
  select.value = state.members.some((member) => member.id === previous) ? previous : 'all'
  ownerFilter = select.value
  enhanceSelects($('#callOwnerSlot'))
}

function renderMetrics(calls: Call[]): void {
  const today = todayKey()
  const todayCount = ownerScope().filter((call) => call.date === today).length
  const total = calls.length
  const reached = calls.filter((call) => call.outcome === 'answered').length
  const conversations = calls.filter((call) => call.conversation).length
  const meetings = calls.filter((call) => call.meeting).length
  // Une part de zéro appel n'a pas de taux : le grand chiffre affiche un tiret,
  // les légendes gardent « 0 % » pour rester lisibles.
  const rate = (part: number): string => (total ? `${Math.round((part / total) * 100)} %` : '0 %')
  const meetingRate = conversations ? Math.round((meetings / conversations) * 100) : 0

  $('#callMetrics').innerHTML = `
    <article class="metric glass"><small>Appels aujourd'hui</small><strong>${todayCount}</strong>
      <span class="metric-trend">${todayCount ? 'en cours de journée' : 'aucun appel passé'}</span></article>
    <article class="metric glass"><small>Appels sur la période</small><strong>${total}</strong>
      <span class="metric-trend">${state.calls.length} au total</span></article>
    <article class="metric glass"><small>Taux de réponse</small><strong>${total ? rate(reached) : '—'}</strong>
      <span class="metric-trend">${reached} réponse(s)</span></article>
    <article class="metric glass"><small>Conversations</small><strong>${conversations}</strong>
      <span class="metric-trend">${rate(conversations)} des appels</span></article>
    <article class="metric glass"><small>Rendez-vous pris</small><strong>${meetings}</strong>
      <span class="metric-trend ${meetings ? 'up' : ''}">${rate(meetings)} des appels</span></article>
    <article class="metric glass"><small>Taux de rendez-vous</small><strong>${conversations ? `${meetingRate} %` : '—'}</strong>
      <span class="metric-trend ${meetingRate >= 20 ? 'up' : 'down'}">par conversation engagée</span></article>`
}

const boolCell = (value: boolean, icon: string, label: string): string =>
  value
    ? `<span class="chip green"><i class="${icon}"></i>${label}</span>`
    : '<span class="chip muted">Non</span>'

/** Cellule en lecture : ce qu'on voit tant qu'on n'a pas cliqué dedans. */
function cellContent(call: Call, field: Field): string {
  switch (field) {
    case 'date':
      return `<span class="num">${formatDayShort(call.date)}</span>`
    case 'meetingAt':
    case 'followUpAt':
      return call[field]
        ? `<span class="num">${formatDayShort(call[field])}</span>`
        : '<span class="cell-void">—</span>'
    case 'outcome': {
      const meta = CALL_OUTCOMES[call.outcome]
      return `<span class="chip ${meta.chip}"><i class="${meta.icon}"></i>${meta.short}</span>`
    }
    case 'conversation':
      return boolCell(call.conversation, 'ri-check-line', 'Oui')
    case 'meeting':
      return boolCell(call.meeting, 'ri-calendar-check-line', 'Oui')
    case 'reason':
      return call.reason ? escapeHtml(CALL_REASONS[call.reason]) : '<span class="cell-void">—</span>'
    case 'objection':
      return call.objection ? escapeHtml(CALL_OBJECTIONS[call.objection]) : '<span class="cell-void">—</span>'
    case 'contact':
    case 'company':
      return call[field] ? `<b>${escapeHtml(call[field])}</b>` : '<span class="cell-void">—</span>'
    case 'phone':
      return call.phone ? `<span class="num">${escapeHtml(call.phone)}</span>` : '<span class="cell-void">—</span>'
    default:
      return call[field] ? escapeHtml(call[field]) : '<span class="cell-void">—</span>'
  }
}

function renderTable(calls: Call[]): void {
  // Réécrire le corps pendant une saisie effacerait le champ ouvert.
  if (editing) return

  const body = $('#callTableBody')

  body.innerHTML = calls
    .map(
      (call) => `
        <tr data-call="${call.id}">
          ${FIELDS.map(
            (field) =>
              `<td class="col-${field} cell-edit" data-field="${field}" title="${LABELS[field]} — cliquer pour modifier">${cellContent(call, field)}</td>`,
          ).join('')}
          <td class="admin-col col-owner"${isAdmin() ? '' : ' hidden'}><span class="chip muted">${escapeHtml(memberName(call.owner_id))}</span></td>
          <td class="col-actions">
            <div class="row-actions">
              <button class="icon-btn" type="button" data-act="open" title="Fiche complète"><i class="ri-expand-diagonal-line"></i></button>
              <button class="icon-btn" type="button" data-act="delete" title="Supprimer"><i class="ri-delete-bin-line"></i></button>
            </div>
          </td>
        </tr>`,
    )
    .join('')

  $$('.admin-col', $('#callTable')).forEach((cell) => {
    cell.hidden = !isAdmin()
  })

  $('#callTableEmpty').innerHTML = calls.length
    ? ''
    : emptyBlock(
        'ri-phone-line',
        state.calls.length ? 'Aucun appel sur ce filtre' : 'Aucun appel enregistré',
        state.calls.length
          ? 'Élargis la période ou remets le résultat sur « tous ».'
          : 'Remplis la ligne bleue en haut du tableau pour enregistrer ton premier appel.',
      )

  body.querySelectorAll<HTMLElement>('tr[data-call]').forEach((row) => {
    const call = state.calls.find((item) => item.id === row.dataset.call)
    if (!call) return

    row.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const action = target.closest<HTMLElement>('[data-act]')?.dataset.act
      if (action === 'delete') return void deleteCall(call)
      if (action === 'open') return openCallForm(call)

      const cell = target.closest<HTMLElement>('.cell-edit')
      if (cell) startEdit(cell, call)
    })
  })
}

async function deleteCall(call: Call): Promise<void> {
  if (!confirm(`Supprimer l'appel du ${formatDayShort(call.date)} — ${call.company || call.contact} ?`)) return
  try {
    await api.deleteCall(call.id)
    removeCall(call.id)
    toast('Appel supprimé.')
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

/* ------------------------------------------------------------ analyses */

/** Barres horizontales classées, sur la rampe monochrome des statistiques. */
function bars(entries: [string, number][], total: number): string {
  if (!entries.length) return '<p class="chart-empty">Rien à afficher sur cette période.</p>'
  const top = entries[0][1] || 1
  return `<div class="chart-bars">${entries
    .map(([label, count], index) => {
      const light = Math.min(index * 12, 48)
      return `
        <div class="chart-bar">
          <span class="chart-bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <span class="chart-bar-track">
            <span class="chart-bar-fill" style="width:${Math.round((count / top) * 100)}%;background:color-mix(in srgb, var(--chart-ramp) ${100 - light}%, var(--chart-ramp-mix))"></span>
          </span>
          <span class="chart-bar-value">${count} · ${Math.round((count / total) * 100)} %</span>
        </div>`
    })
    .join('')}</div>`
}

/** Décompte trié d'un libellé, en ignorant les valeurs non renseignées. */
function tally(calls: Call[], pick: (call: Call) => string): [string, number][] {
  const counts = new Map<string, number>()
  calls.forEach((call) => {
    const label = pick(call)
    if (!label) return
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function renderInsights(calls: Call[]): void {
  const reasons = tally(calls, (call) => (call.meeting || !call.reason ? '' : CALL_REASONS[call.reason]))
  const objections = tally(calls, (call) => (call.objection ? CALL_OBJECTIONS[call.objection] : ''))
  const reasonTotal = reasons.reduce((sum, [, count]) => sum + count, 0)
  const objectionTotal = objections.reduce((sum, [, count]) => sum + count, 0)

  $('#callInsights').innerHTML = `
    <section class="card glass">
      <div class="card-head">
        <div><h2>Pourquoi ça n'aboutit pas</h2><p>Raisons invoquées quand l'appel ne donne pas de rendez-vous.</p></div>
        <span class="chart-total">${reasonTotal}</span>
      </div>
      ${bars(reasons, reasonTotal)}
    </section>
    <section class="card glass">
      <div class="card-head">
        <div><h2>Objections entendues</h2><p>Ce qu'il faut savoir traiter pour convertir davantage.</p></div>
        <span class="chart-total">${objectionTotal}</span>
      </div>
      ${bars(objections, objectionTotal)}
    </section>`

  renderRhythm()
}

/** Volume quotidien des 14 derniers jours, rendez-vous mis en évidence. */
function renderRhythm(): void {
  const scope = ownerScope()
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - index))
    const key = todayKey(date)
    const dayCalls = scope.filter((call) => call.date === key)
    return {
      key,
      label: date.toLocaleDateString('fr-FR', { day: '2-digit' }),
      total: dayCalls.length,
      meetings: dayCalls.filter((call) => call.meeting).length,
    }
  })

  const peak = Math.max(...days.map((day) => day.total))
  if (!peak) {
    $('#callRhythm').innerHTML = '<p class="chart-empty">Aucun appel sur les quatorze derniers jours.</p>'
    return
  }
  // Une seule valeur chiffrée, sur le pic : quatorze nombres alignés en haut du
  // graphique se liraient moins bien que la hauteur des colonnes elle-même.
  const peakIndex = days.findIndex((day) => day.total === peak)

  $('#callRhythm').innerHTML = `
    <div class="chart-legend">
      <span class="legend-item"><span class="legend-swatch" style="background:var(--chart-ramp)"></span>Appels passés</span>
      <span class="legend-item"><span class="legend-swatch" style="background:var(--green)"></span>Dont rendez-vous</span>
    </div>
    <div class="chart-columns">
      ${days
        .map((day, index) => {
          // Un appel isolé doit rester visible : 3 % de hauteur minimum.
          const height = day.total ? Math.max((day.total / peak) * 100, 3) : 0
          const share = day.total ? Math.round((day.meetings / day.total) * 100) : 0
          return `
        <div class="chart-column" title="${escapeHtml(formatDayShort(day.key))} — ${day.total} appel(s), ${day.meetings} rendez-vous">
          <span class="chart-column-track">
            ${index === peakIndex ? `<span class="chart-column-peak">${day.total}</span>` : ''}
            <span class="chart-column-fill call-column" style="height:${Math.round(height)}%">
              <span class="call-column-meetings" style="height:${share}%"></span>
            </span>
          </span>
          <span class="chart-column-label">${day.label}</span>
        </div>`
        })
        .join('')}
    </div>`
}
