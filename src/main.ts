import { api } from './api.js'
import { currentProfile, onAuthChange, sendPasswordReset, signIn, signOut, updateOwnPassword } from './auth.js'
import { initDrawer } from './drawer.js'
import { openEventForm, openLeadForm } from './forms.js'
import { closeModal, initOverlays, openModal } from './modal.js'
import { hydrate, isAdmin, state } from './store.js'
import type { Theme } from './types.js'
import { $, $$, escapeHtml, toast } from './ui.js'
import { initAdmin, loadMembers } from './views/admin.js'
import { initCalendar } from './views/calendar.js'
import { initDashboard } from './views/dashboard.js'
import { initLeads } from './views/leads.js'
import { initPipeline } from './views/pipeline.js'

const VIEWS = ['dashboard', 'pipeline', 'leads', 'calendar', 'admin']

/* ------------------------------------------------------------ navigation */

function showView(view: string): void {
  // La vue d'administration n'existe que pour les comptes admin.
  const target = view === 'admin' && !isAdmin() ? 'dashboard' : view
  $$('.nav-btn').forEach((button) => button.classList.toggle('active', button.dataset.view === target))
  $$('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${target}`))
  window.location.hash = target
}

function initNavigation(): void {
  $$('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view as string))
  })

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const go = target.closest<HTMLElement>('[data-go]')
    if (go) showView(go.dataset.go as string)

    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === 'new-lead') openLeadForm()
    if (action === 'new-event') openEventForm()
  })

  const initial = window.location.hash.replace('#', '')
  if (VIEWS.includes(initial)) showView(initial)
}

/* ---------------------------------------------------------------- thèmes */

function applyTheme(theme: Theme): void {
  document.body.dataset.theme = theme
  $$('.theme-option').forEach((option) => option.classList.toggle('active', option.dataset.theme === theme))
}

function initTheme(): void {
  const wrap = $('#themeWrap')

  $('#themeToggle').addEventListener('click', (event) => {
    event.stopPropagation()
    wrap.classList.toggle('open')
  })

  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target as Node)) wrap.classList.remove('open')
  })

  $$('.theme-option').forEach((option) => {
    option.addEventListener('click', async () => {
      const theme = option.dataset.theme as Theme
      state.theme = theme
      applyTheme(theme)
      wrap.classList.remove('open')
      try {
        await api.saveTheme(theme)
      } catch {
        /* le thème reste appliqué localement même si l'enregistrement échoue */
      }
    })
  })
}

/* ------------------------------------------------------------- raccourcis */

function initShortcuts(): void {
  document.addEventListener('keydown', (event) => {
    const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)
    if (editing || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'n') {
      event.preventDefault()
      openLeadForm()
    }
    if (event.key === 'e') {
      event.preventDefault()
      openEventForm()
    }
  })
}

/* ------------------------------------------------------------ connexion */

function showAuthScreen(message = ''): void {
  $('#authScreen').hidden = false
  $('#app').hidden = true
  const error = $('#authError')
  error.hidden = !message
  error.textContent = message
}

function showApp(): void {
  $('#authScreen').hidden = true
  $('#app').hidden = false
}

function initLogin(): void {
  const form = $<HTMLFormElement>('#loginForm')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    const data = new FormData(form)
    if (submit) submit.disabled = true
    try {
      await signIn(String(data.get('email') ?? ''), String(data.get('password') ?? ''))
      $('#authError').hidden = true
      await start()
    } catch (error) {
      showAuthScreen((error as Error).message)
    } finally {
      if (submit) submit.disabled = false
    }
  })

  $('#resetPassword').addEventListener('click', async () => {
    const email = $<HTMLInputElement>('#loginEmail').value.trim()
    if (!email) {
      showAuthScreen("Saisis d'abord ton email, le lien de réinitialisation y sera envoyé.")
      return
    }
    try {
      await sendPasswordReset(email)
      toast('Email de réinitialisation envoyé.')
    } catch (error) {
      showAuthScreen((error as Error).message)
    }
  })
}

/* --------------------------------------------------------- menu du compte */

function initAccountMenu(): void {
  const wrap = $('#accountWrap')

  $('#accountToggle').addEventListener('click', (event) => {
    event.stopPropagation()
    wrap.classList.toggle('open')
  })

  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target as Node)) wrap.classList.remove('open')
  })

  $('#signOut').addEventListener('click', async () => {
    await signOut()
    window.location.reload()
  })

  $('#changePassword').addEventListener('click', () => {
    wrap.classList.remove('open')
    const panel = openModal(`
      <form id="passwordForm">
        <div class="panel-head">
          <div><h2>Changer mon mot de passe</h2><p>Il remplace immédiatement l'ancien.</p></div>
          <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
        </div>
        <div class="field-group"><label for="p-new">Nouveau mot de passe</label>
          <input class="field" id="p-new" name="password" type="password" required minlength="8" placeholder="8 caractères minimum"></div>
        <div class="form-actions">
          <button class="btn" type="button" data-close-modal>Annuler</button>
          <button class="btn primary" type="submit"><i class="ri-check-line"></i>Enregistrer</button>
        </div>
      </form>`)

    $<HTMLFormElement>('#passwordForm', panel).addEventListener('submit', async (event) => {
      event.preventDefault()
      try {
        await updateOwnPassword($<HTMLInputElement>('#p-new', panel).value)
        closeModal()
        toast('Mot de passe mis à jour.')
      } catch (error) {
        toast((error as Error).message, 'error')
      }
    })
  })
}

function renderAccount(): void {
  const profile = state.profile
  if (!profile) return
  const name = profile.full_name || profile.email
  $('#accountAvatar').textContent = name.slice(0, 2).toUpperCase()
  $('#accountName').textContent = name
  $('#accountRole').textContent = profile.role === 'admin' ? 'Administrateur' : 'Commercial'
  $('#accountEmail').innerHTML = escapeHtml(profile.email)
  $$('.admin-only').forEach((node) => {
    node.hidden = profile.role !== 'admin'
  })
}

/* -------------------------------------------------------------- démarrage */

let starting = false

/** Charge la session, les données autorisées, puis affiche l'application. */
async function start(): Promise<void> {
  // signIn() déclenche aussi l'événement SIGNED_IN : on évite le double chargement.
  if (starting) return
  starting = true
  try {
    await load()
  } finally {
    starting = false
  }
}

async function load(): Promise<void> {
  let profile
  try {
    profile = await currentProfile()
  } catch (error) {
    showAuthScreen((error as Error).message)
    return
  }

  if (!profile) {
    showAuthScreen()
    return
  }

  showApp()

  try {
    const loaded = await api.loadState()
    hydrate(loaded)
    applyTheme(loaded.theme)
    renderAccount()
    if (isAdmin()) void loadMembers()
  } catch (error) {
    toast(`Chargement impossible : ${(error as Error).message}`, 'error')
  }
}

async function boot(): Promise<void> {
  initOverlays()
  initNavigation()
  initTheme()
  initShortcuts()
  initLogin()
  initAccountMenu()
  initDrawer()
  initDashboard()
  initPipeline()
  initLeads()
  initCalendar()
  initAdmin(showView)

  onAuthChange(() => void start())
  await start()
}

void boot()
