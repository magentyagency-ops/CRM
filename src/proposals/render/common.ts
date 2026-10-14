import type { Brief, PricingLine, StudioInput } from '../model.js'

/** Coordonnées de Nira, émetteur de toutes les propositions. */
export const NIRA = {
  name: 'Nira',
  siret: '951 653 476 00014',
  address: '8 rue Pouchet',
  postalCity: '76000 Rouen',
  email: 'clarence@nira-ia.com',
  vatNote: 'TVA non applicable, art. 293 B du CGI',
}

export interface Pricing {
  lines: PricingLine[]
  total: number
  paymentTerms: string[]
  validityDays: number
}

/**
 * Le prix saisi par le commercial fait foi. Si les lignes du modèle ne
 * retombent pas exactement sur ce montant, elles sont remplacées par un forfait
 * unique : un document commercial ne doit jamais afficher deux totaux.
 */
export function pricingOf(brief: Brief, input: StudioInput): Pricing {
  const lines = brief.pricing.lines.filter((line) => line.label && Number.isFinite(line.total))
  const sum = lines.reduce((total, line) => total + line.total, 0)
  const wanted = input.price
  const consistent = lines.length > 0 && (wanted <= 0 || Math.abs(sum - wanted) < 1)

  const paymentTerms = input.billing.paymentTerms.trim()
    ? input.billing.paymentTerms.split(/\n|;/).map((term) => term.trim()).filter(Boolean)
    : brief.pricing.paymentTerms

  return {
    lines: consistent
      ? lines
      : [
          {
            label: brief.solution.name || brief.projectTitle,
            description: brief.objet,
            quantity: '1 forfait',
            unitPrice: wanted,
            total: wanted,
          },
        ],
    total: consistent ? sum : wanted,
    paymentTerms,
    validityDays: brief.pricing.validityDays || 30,
  }
}

/** Script commun aux documents : `#print` ouvre directement l'impression PDF. */
export const PRINT_ON_HASH = `
if (location.hash === '#print') {
  const go = () => setTimeout(() => window.print(), 350)
  document.fonts && document.fonts.ready ? document.fonts.ready.then(go) : window.addEventListener('load', go)
}`
