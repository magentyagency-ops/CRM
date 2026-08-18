import { $ } from './ui.js'

const modal = () => $('#modal')
const modalPanel = () => $('#modalPanel')
const drawer = () => $('#leadDrawer')
const drawerPanel = () => $('#leadDrawerPanel')

export function openModal(html: string): HTMLElement {
  const panel = modalPanel()
  panel.innerHTML = html
  modal().setAttribute('aria-hidden', 'false')
  const firstField = panel.querySelector<HTMLElement>('input, textarea, select')
  firstField?.focus()
  return panel
}

export function closeModal(): void {
  modal().setAttribute('aria-hidden', 'true')
  modalPanel().innerHTML = ''
}

export const isModalOpen = (): boolean => modal().getAttribute('aria-hidden') === 'false'

export function openDrawer(html: string): HTMLElement {
  const panel = drawerPanel()
  panel.innerHTML = html
  drawer().setAttribute('aria-hidden', 'false')
  return panel
}

export function closeDrawer(): void {
  drawer().setAttribute('aria-hidden', 'true')
  drawerPanel().innerHTML = ''
}

export const isDrawerOpen = (): boolean => drawer().getAttribute('aria-hidden') === 'false'

export function initOverlays(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-close-modal]')) closeModal()
    if (target.closest('[data-close-drawer]')) closeDrawer()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (isModalOpen()) closeModal()
    else if (isDrawerOpen()) closeDrawer()
  })
}
