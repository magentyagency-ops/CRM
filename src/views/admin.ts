import { adminApi } from '../adminApi.js'
import { closeModal, openModal } from '../modal.js'
import { isAdmin, setOwnerFilter, subscribe } from '../store.js'
import type { Member, Role } from '../types.js'
import {
  $,
  emptyBlock,
  escapeHtml,
  formatCompactMoney,
  formatDate,
  formatMoney,
  relativeDays,
  toast,
  viewIsActive,
} from '../ui.js'

let members: Member[] = []
let loading = false
let loadError = ''

export function initAdmin(onNavigate: (view: string) => void): void {
  navigate = onNavigate

  $('#refreshMembers').addEventListener('click', () => void loadMembers())

  document.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === 'new-member') openMemberForm()
  })

  // Les comptes ne sont rechargés que lorsqu'un admin est connecté.
  subscribe(() => {
    if (isAdmin() && !members.length && !loading && !loadError) void loadMembers()
    render()
  })
}

let navigate: (view: string) => void = () => {}

export async function loadMembers(): Promise<void> {
  if (!isAdmin()) return
  loading = true
  loadError = ''
  render()
  try {
    const { members: list } = await adminApi.list()
    members = list
  } catch (error) {
    loadError = (error as Error).message
  } finally {
    loading = false
    render()
  }
}

function render(): void {
  if (!isAdmin() || !viewIsActive('admin')) return
  renderMetrics()
  renderList()
}

function renderMetrics(): void {
  const node = $('#adminMetrics')
  const active = members.filter((member) => member.active)
  const admins = members.filter((member) => member.role === 'admin')
  const openValue = members.reduce((sum, member) => sum + member.stats.openValue, 0)
  const wonValue = members.reduce((sum, member) => sum + member.stats.wonValue, 0)

  node.innerHTML = `
    <article class="metric glass"><small>Comptes</small><strong>${members.length}</strong>
      <span class="metric-trend">${active.length} actif(s) · ${admins.length} admin(s)</span></article>
    <article class="metric glass"><small>Pipeline équipe</small><strong>${formatCompactMoney(openValue)}</strong>
      <span class="metric-trend">toutes opportunités ouvertes</span></article>
    <article class="metric glass"><small>Signé équipe</small><strong>${formatCompactMoney(wonValue)}</strong>
      <span class="metric-trend up">cumul des deals gagnés</span></article>
    <article class="metric glass"><small>Deals suivis</small><strong>${members.reduce((sum, m) => sum + m.stats.leads, 0)}</strong>
      <span class="metric-trend">tous comptes confondus</span></article>`
}

function renderList(): void {
  const node = $('#memberList')

  if (loading && !members.length) {
    node.innerHTML = emptyBlock('ri-loader-4-line', 'Chargement des comptes…', 'Interrogation de l’API d’administration.')
    return
  }

  if (loadError) {
    node.innerHTML = emptyBlock(
      'ri-error-warning-line',
      'Administration indisponible',
      `${loadError} — vérifie que SUPABASE_SERVICE_ROLE_KEY est bien défini côté Vercel.`,
    )
    return
  }

  if (!members.length) {
    node.innerHTML = emptyBlock('ri-team-line', 'Aucun compte', 'Crée le premier accès de ton équipe.')
    return
  }

  node.innerHTML = `<div class="member-list">${members
    .map((member) => {
      const name = member.full_name || member.email
      const initials = name.slice(0, 2).toUpperCase()
      return `
        <article class="member-card${member.active ? '' : ' inactive'}" data-member="${member.id}">
          <span class="member-avatar">${escapeHtml(initials)}</span>
          <div class="member-identity">
            <b>${escapeHtml(name)}
              <span class="chip ${member.role === 'admin' ? 'violet' : 'muted'}">${member.role === 'admin' ? 'Admin' : 'Commercial'}</span>
              ${member.active ? '' : '<span class="chip red">Désactivé</span>'}
            </b>
            <span>${escapeHtml(member.email)} · créé le ${formatDate(member.created_at)}</span>
          </div>
          <div class="member-stats">
            <div><small>Pipeline</small><b>${formatMoney(member.stats.openValue)}</b></div>
            <div><small>Signé</small><b>${formatMoney(member.stats.wonValue)}</b></div>
            <div><small>Deals</small><b>${member.stats.leads} <span class="muted">(${member.stats.open} ouverts)</span></b></div>
            <div><small>Dernière activité</small><b>${member.stats.lastActivity ? relativeDays(member.stats.lastActivity) : '—'}</b></div>
          </div>
          <div class="member-actions">
            <button class="btn" type="button" data-act="deals"><i class="ri-flow-chart"></i>Voir ses deals</button>
            <button class="btn" type="button" data-act="edit"><i class="ri-settings-3-line"></i>Gérer</button>
          </div>
        </article>`
    })
    .join('')}</div>`

  node.querySelectorAll<HTMLElement>('[data-member]').forEach((card) => {
    const member = members.find((item) => item.id === card.dataset.member)
    if (!member) return
    card.querySelector('[data-act="deals"]')?.addEventListener('click', () => {
      setOwnerFilter([member.id])
      navigate('pipeline')
      toast(`Pipeline filtré sur ${member.full_name || member.email}.`)
    })
    card.querySelector('[data-act="edit"]')?.addEventListener('click', () => openMemberForm(member))
  })
}

/* -------------------------------------------------------- création / édition */

export function openMemberForm(member?: Member): void {
  const isEdit = Boolean(member)

  const panel = openModal(`
    <form id="memberForm">
      <div class="panel-head">
        <div>
          <h2>${isEdit ? 'Gérer le compte' : 'Nouveau compte'}</h2>
          <p>${
            isEdit
              ? 'Modifie les droits, réinitialise le mot de passe ou désactive l’accès.'
              : 'Le compte est créé immédiatement et peut se connecter avec ce mot de passe.'
          }</p>
        </div>
        <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>
      <div class="form-grid">
        <div class="field-group"><label for="m-name">Nom</label>
          <input class="field" id="m-name" name="full_name" value="${escapeHtml(member?.full_name ?? '')}" placeholder="Camille Durand"></div>
        <div class="field-group"><label for="m-email">Email</label>
          <input class="field" id="m-email" name="email" type="email" ${isEdit ? 'disabled' : 'required'} value="${escapeHtml(member?.email ?? '')}" placeholder="camille@nira-ia.com"></div>
        <div class="field-group"><label for="m-role">Rôle</label>
          <select class="field" id="m-role" name="role">
            <option value="user"${member?.role === 'admin' ? '' : ' selected'}>Commercial — ne voit que ses deals</option>
            <option value="admin"${member?.role === 'admin' ? ' selected' : ''}>Administrateur — voit tout et gère les comptes</option>
          </select></div>
        <div class="field-group"><label for="m-password">${isEdit ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}</label>
          <input class="field" id="m-password" name="password" type="text" ${isEdit ? '' : 'required'} minlength="8" placeholder="8 caractères minimum"></div>
        ${
          isEdit
            ? `<div class="field-group full"><label for="m-active">Accès</label>
                <select class="field" id="m-active" name="active">
                  <option value="true"${member?.active ? ' selected' : ''}>Actif</option>
                  <option value="false"${member?.active ? '' : ' selected'}>Désactivé — connexion refusée</option>
                </select></div>`
            : ''
        }
      </div>
      <div class="form-actions">
        ${isEdit ? '<button class="btn danger spacer" type="button" id="deleteMember"><i class="ri-delete-bin-line"></i>Supprimer le compte</button>' : ''}
        <button class="btn" type="button" data-close-modal>Annuler</button>
        <button class="btn primary" type="submit"><i class="ri-check-line"></i>${isEdit ? 'Enregistrer' : 'Créer le compte'}</button>
      </div>
    </form>`)

  const form = $<HTMLFormElement>('#memberForm', panel)

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const data = new FormData(form)
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (submit) submit.disabled = true

    try {
      if (member) {
        await adminApi.update({
          id: member.id,
          full_name: String(data.get('full_name') ?? '').trim(),
          role: (data.get('role') as Role) ?? 'user',
          active: String(data.get('active') ?? 'true') === 'true',
          password: String(data.get('password') ?? '') || undefined,
        })
        toast('Compte mis à jour.')
      } else {
        await adminApi.create({
          email: String(data.get('email') ?? ''),
          password: String(data.get('password') ?? ''),
          full_name: String(data.get('full_name') ?? '').trim(),
          role: (data.get('role') as Role) ?? 'user',
        })
        toast('Compte créé.')
      }
      closeModal()
      await loadMembers()
    } catch (error) {
      toast((error as Error).message, 'error')
      if (submit) submit.disabled = false
    }
  })

  panel.querySelector('#deleteMember')?.addEventListener('click', async () => {
    if (!member) return
    const confirmation = confirm(
      `Supprimer le compte ${member.full_name || member.email} ?\n\n` +
        `Ses ${member.stats.leads} deal(s) et ses rendez-vous seront transférés à ton compte administrateur.`,
    )
    if (!confirmation) return
    try {
      await adminApi.remove({ id: member.id })
      closeModal()
      toast('Compte supprimé, ses deals ont été transférés.')
      await loadMembers()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })
}

export const adminMembers = (): Member[] => members
