import { $$, escapeHtml } from './ui.js'

/**
 * Listes déroulantes maison.
 *
 * Un `<select>` natif n'est stylable que fermé : sa liste est dessinée par le
 * système, avec ses propres couleurs et ses propres coins. On garde donc le
 * select — il reste la source de vérité pour `FormData` et pour `.value` — mais
 * on le rend invisible derrière un bouton et une liste que l'on dessine.
 *
 * Le menu est posé sur `<body>` en position fixe : à l'intérieur du tableau il
 * serait coupé par le défilement horizontal et par les cellules à débordement
 * masqué.
 */

interface Ouverture {
  shell: HTMLElement
  select: HTMLSelectElement
  menu: HTMLElement
  index: number
}

let ouverture: Ouverture | null = null

/* ------------------------------------------------------------ fabrication */

/** Habille les listes déroulantes d'un fragment ; les déjà traitées sont resynchronisées. */
export function enhanceSelects(scope: ParentNode = document): void {
  $$<HTMLSelectElement>('select.field', scope).forEach((select) => {
    if (select.dataset.enhanced) refreshSelect(select)
    else habiller(select)
  })
}

/** Remet le libellé et l'état d'un bouton en phase avec son select. */
export function refreshSelect(select: HTMLSelectElement): void {
  const shell = select.closest<HTMLElement>('.select-shell')
  if (!shell) return
  const bouton = shell.querySelector<HTMLButtonElement>('.select-btn')
  const valeur = shell.querySelector<HTMLElement>('.select-value')
  if (!bouton || !valeur) return

  valeur.textContent = select.selectedOptions[0]?.textContent ?? ''
  bouton.disabled = select.disabled
  shell.classList.toggle('disabled', select.disabled)
  if (select.disabled && ouverture?.select === select) fermer()
}

/** Resynchronise tout un fragment après une modification par le code. */
export const refreshSelects = (scope: ParentNode = document): void =>
  $$<HTMLSelectElement>('select.field', scope).forEach(refreshSelect)

function habiller(select: HTMLSelectElement): void {
  const shell = document.createElement('div')
  shell.className = 'select-shell'
  select.parentNode?.insertBefore(shell, select)
  shell.appendChild(select)

  select.dataset.enhanced = 'true'
  // Le select reste dans le flux du formulaire, mais hors du parcours clavier :
  // c'est le bouton qui prend le focus.
  select.tabIndex = -1
  select.setAttribute('aria-hidden', 'true')

  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = 'select-btn'
  bouton.setAttribute('aria-haspopup', 'listbox')
  bouton.setAttribute('aria-expanded', 'false')
  const etiquette = select.getAttribute('aria-label')
  if (etiquette) bouton.setAttribute('aria-label', etiquette)
  bouton.innerHTML = '<span class="select-value"></span><span class="select-caret"></span>'
  shell.insertBefore(bouton, select)

  bouton.addEventListener('click', (event) => {
    event.stopPropagation()
    if (ouverture?.select === select) fermer()
    else ouvrir(shell, select)
  })

  bouton.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      if (!ouverture) ouvrir(shell, select)
    }
  })

  refreshSelect(select)
}

/* ---------------------------------------------------------------- menu */

function ouvrir(shell: HTMLElement, select: HTMLSelectElement): void {
  if (select.disabled) return
  fermer()

  const menu = document.createElement('div')
  menu.className = 'select-menu'
  menu.setAttribute('role', 'listbox')
  menu.innerHTML = [...select.options]
    .map(
      (option, index) => `
      <button class="select-option" type="button" role="option" data-index="${index}"
        aria-selected="${option.selected}"${option.disabled ? ' disabled' : ''}>
        <span>${escapeHtml(option.textContent ?? '')}</span><i class="ri-check-line"></i>
      </button>`,
    )
    .join('')
  document.body.appendChild(menu)

  ouverture = { shell, select, menu, index: select.selectedIndex }
  shell.classList.add('open')
  shell.querySelector('.select-btn')?.setAttribute('aria-expanded', 'true')
  placer()
  surligner(select.selectedIndex)

  menu.addEventListener('mousedown', (event) => {
    // Empêche la perte de focus avant le clic : en édition de cellule, un flou
    // valide la saisie et détruirait le menu avant qu'il ne serve.
    event.preventDefault()
  })

  menu.addEventListener('click', (event) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('.select-option')
    if (!option) return
    choisir(Number(option.dataset.index))
  })

  menu.addEventListener('mousemove', (event) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('.select-option')
    if (option) surligner(Number(option.dataset.index))
  })
}

/** Place le menu sous le bouton, ou au-dessus s'il déborderait de l'écran. */
function placer(): void {
  if (!ouverture) return
  const { shell, menu } = ouverture
  const zone = shell.getBoundingClientRect()
  const hauteur = menu.offsetHeight
  const dessous = window.innerHeight - zone.bottom

  menu.style.minWidth = `${Math.max(zone.width, 150)}px`
  menu.style.left = `${Math.min(zone.left, window.innerWidth - menu.offsetWidth - 12)}px`
  menu.style.top = dessous < hauteur + 16 && zone.top > hauteur ? `${zone.top - hauteur - 6}px` : `${zone.bottom + 6}px`
}

function surligner(index: number): void {
  if (!ouverture) return
  ouverture.index = index
  $$('.select-option', ouverture.menu).forEach((option, position) => {
    option.classList.toggle('active', position === index)
    if (position === index) option.scrollIntoView({ block: 'nearest' })
  })
}

function choisir(index: number): void {
  if (!ouverture) return
  const { select } = ouverture
  const option = select.options[index]
  if (!option || option.disabled) return

  const change = select.selectedIndex !== index
  select.selectedIndex = index
  refreshSelect(select)
  fermer()
  // Les vues écoutent le select natif : l'événement doit venir de lui.
  if (change) {
    select.dispatchEvent(new Event('input', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

export function fermer(): void {
  if (!ouverture) return
  const { shell, menu } = ouverture
  menu.remove()
  shell.classList.remove('open')
  shell.querySelector('.select-btn')?.setAttribute('aria-expanded', 'false')
  ouverture = null
}

/* ------------------------------------------------------------- clavier */

export function initSelects(): void {
  document.addEventListener('keydown', (event) => {
    if (!ouverture) return
    const total = ouverture.select.options.length
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const pas = event.key === 'ArrowDown' ? 1 : -1
      surligner((ouverture.index + pas + total) % total)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choisir(ouverture.index)
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      // Échap ne doit pas remonter jusqu'à la modale : il ferme d'abord le menu.
      event.stopPropagation()
      const bouton = ouverture.shell.querySelector<HTMLElement>('.select-btn')
      fermer()
      bouton?.focus()
    }
  }, true)

  document.addEventListener('mousedown', (event) => {
    if (ouverture && !ouverture.shell.contains(event.target as Node)) fermer()
  })

  // Un menu posé en position fixe ne suit pas la page : on le referme plutôt
  // que de le laisser flotter à côté de son bouton. Son propre défilement
  // interne, lui, doit être ignoré : une liste longue se parcourt.
  window.addEventListener('scroll', (event) => {
    if (ouverture && !ouverture.menu.contains(event.target as Node)) fermer()
  }, true)
  window.addEventListener('resize', fermer)

  enhanceSelects()
}

/* -------------------------------------------------------------- dates */

/**
 * Un champ date n'ouvre son calendrier qu'au clic sur la petite icône du
 * système. On l'ouvre depuis n'importe quel point du champ : la cible est
 * bien plus grande, et le geste devient le même que pour une liste déroulante.
 */
export function initDateFields(): void {
  document.addEventListener('click', (event) => {
    const champ = (event.target as HTMLElement).closest<HTMLInputElement>('input[type="date"]')
    if (!champ || champ.disabled || champ.readOnly) return
    try {
      champ.showPicker()
    } catch {
      /* Navigateur sans `showPicker` (Safari) : la saisie au clavier suffit. */
    }
  })
}
