import { api } from './api.js'
import { initDrawer } from './drawer.js'
import { openEventForm, openLeadForm } from './forms.js'
import { initOverlays } from './modal.js'
import { hydrate, state } from './store.js'
import type { Theme } from './types.js'
import { $, $$, toast } from './ui.js'
import { initCalendar } from './views/calendar.js'
import { initDashboard } from './views/dashboard.js'
import { initLeads } from './views/leads.js'
import { initPipeline } from './views/pipeline.js'

/* ------------------------------------------------------------ navigation */

function showView(view: string): void {
  $$('.nav-btn').forEach((button) => button.classList.toggle('active', button.dataset.view === view))
  $$('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`))
  window.location.hash = view
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
  if (['dashboard', 'pipeline', 'leads', 'calendar'].includes(initial)) showView(initial)
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

/* -------------------------------------------------------------- démarrage */

async function boot(): Promise<void> {
  initOverlays()
  initNavigation()
  initTheme()
  initShortcuts()
  initDrawer()
  initDashboard()
  initPipeline()
  initLeads()
  initCalendar()

  try {
    const loaded = await api.loadState()
    hydrate(loaded)
    applyTheme(loaded.theme)
  } catch (error) {
    toast(`Serveur injoignable : ${(error as Error).message}`, 'error')
  }
}

void boot()
