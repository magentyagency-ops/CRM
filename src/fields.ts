/**
 * Comportements des champs de saisie qui ne relèvent pas d'un composant à part
 * entière : ouverture du calendrier, filtrage d'un numéro de téléphone. Ils
 * sont posés une fois sur le document et valent pour tous les écrans, y compris
 * les formulaires reconstruits à chaque ouverture.
 */

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

/** Tout ce qui n'a pas sa place dans un numéro : lettres, ponctuation exotique. */
const HORS_TELEPHONE = /[^\d+().\-\s]/g

/**
 * Un numéro de téléphone ne contient que des chiffres et les quelques signes
 * qui les séparent. Plutôt que de refuser la saisie après coup, les caractères
 * interdits sont retirés à la frappe — le collage d'un numéro mal formaté est
 * nettoyé de la même façon.
 */
export function initPhoneFields(): void {
  document.addEventListener('input', (event) => {
    const champ = (event.target as HTMLElement).closest<HTMLInputElement>('input[type="tel"]')
    if (!champ) return
    const propre = champ.value.replace(HORS_TELEPHONE, '')
    if (propre === champ.value) return
    // Le curseur recule d'un cran par caractère refusé, sans quoi il sauterait
    // en fin de champ à chaque correction.
    const position = Math.max(0, (champ.selectionStart ?? propre.length) - (champ.value.length - propre.length))
    champ.value = propre
    champ.setSelectionRange(position, position)
  })
}
