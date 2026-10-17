import { saveLeadLogo } from './api.js'
import { accessToken } from './auth.js'
import { notify, state, subscribe } from './store.js'
import type { Lead } from './types.js'

/**
 * Recherche des logos en arrière-plan.
 *
 * Un lead sans logo connu (`logo === ''`) est confié à `/api/logo`, qui
 * retrouve le site de l'entreprise et son icône ; le résultat est enregistré
 * sur le lead, si bien que chaque entreprise n'est cherchée qu'une fois.
 */

const PARALLEL = 3
const attempted = new Set<string>()
const queued = new Set<string>()
let running = 0

async function resolve(lead: Lead): Promise<void> {
  // Une entreprise déjà connue (autre vente, autre contact) reprend son logo sans nouvelle recherche.
  const key = lead.company.trim().toLowerCase()
  const known = key && state.leads.find((item) => item.id !== lead.id && item.company.trim().toLowerCase() === key && item.logo && item.logo !== 'none')
  if (known && !lead.website) {
    lead.logo = known.logo
    lead.website = known.website
    await saveLeadLogo(lead.id, lead.website, lead.logo)
    notify()
    return
  }
  const params = new URLSearchParams({ company: lead.company, email: lead.email, website: lead.website ?? '' })
  const response = await fetch(`/api/logo?${params}`, { headers: { Authorization: `Bearer ${await accessToken()}` } })
  if (!response.ok) return
  const { website, logo } = (await response.json()) as { website: string; logo: string }
  const current = state.leads.find((item) => item.id === lead.id)
  if (!current) return
  current.logo = logo || 'none'
  if (!current.website && website) current.website = website
  await saveLeadLogo(current.id, current.website, current.logo)
  notify()
}

function pump(): void {
  while (running < PARALLEL) {
    const next = state.leads.find((lead) => queued.has(lead.id) && lead.logo === '')
    if (!next) return
    queued.delete(next.id)
    running++
    void resolve(next)
      .catch(() => undefined)
      .finally(() => {
        running--
        pump()
      })
  }
}

function scan(): void {
  for (const lead of state.leads) {
    // Une recherche par lead et par session : un échec ne boucle pas.
    if (lead.logo === '' && (lead.company || lead.email) && !attempted.has(`${lead.id}|${lead.company}|${lead.email}|${lead.website}`)) {
      attempted.add(`${lead.id}|${lead.company}|${lead.email}|${lead.website}`)
      queued.add(lead.id)
    }
  }
  pump()
}

export function initLogos(): void {
  subscribe(scan)
  scan()
}
