import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireActiveUser, respond } from './_lib/guard.js'

/**
 * Retrouve le logo d'une entreprise.
 *
 * Le site de l'entreprise est déduit, dans l'ordre : du site saisi sur le lead,
 * du domaine de l'e-mail du contact (hors messageries grand public), puis de
 * son nom. Le logo retenu est l'icône que le site publie pour les écrans
 * d'accueil (nette et carrée), à défaut celle que Google référence.
 */

export const config = { maxDuration: 20 }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36'

const GENERIC_MAIL =
  /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|orange|wanadoo|free|sfr|neuf|bbox|laposte|aol|proton|protonmail|gmx|yopmail|hotmail\.co|club-internet|numericable)\./i

const isPrivateHost = (hostname: string) =>
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1|0\.)/i.test(hostname)

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(sas|sarl|sa|sasu|eurl|groupe|group|inc|ltd|gmbh)\b/g, '')
    .replace(/[^a-z0-9]/g, '')

function hostOf(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (isPrivateHost(url.hostname) || !url.hostname.includes('.')) return ''
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

async function get(url: string, timeout = 6000): Promise<Response | null> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || isPrivateHost(parsed.hostname)) return null
    return await fetch(parsed, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': UA }, redirect: 'follow' })
  } catch {
    return null
  }
}

/**
 * Domaines possibles d'une entreprise d'après son nom, dans l'ordre de
 * notoriété de l'annuaire, sans les noms qui ne lui correspondent pas.
 */
async function domainsFromName(company: string): Promise<string[]> {
  const wanted = normalize(company)
  if (wanted.length < 2) return []
  const response = await get(
    `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company.trim())}`,
  )
  if (!response?.ok) return []
  const results = ((await response.json().catch(() => [])) as { name?: string; domain?: string }[]) ?? []
  return results
    .filter((item) => {
      const name = normalize(item.name ?? '')
      const domain = normalize((item.domain ?? '').split('.')[0])
      return name === wanted || domain === wanted || name.startsWith(wanted) || wanted.startsWith(name)
    })
    .map((item) => hostOf(item.domain ?? ''))
    .filter(Boolean)
    .slice(0, 3)
}

async function isImage(url: string): Promise<boolean> {
  const response = await get(url)
  if (!response?.ok) return false
  const type = response.headers.get('content-type') ?? ''
  const body = await response.arrayBuffer().catch(() => new ArrayBuffer(0))
  return (type.startsWith('image/') || /\.(png|svg|ico|jpg|jpeg|webp)(\?|$)/i.test(url)) && body.byteLength > 200
}

/** Icône publiée par le site : apple-touch-icon en priorité, puis la plus grande icône déclarée. */
async function iconFromSite(domain: string): Promise<string> {
  const response = await get(`https://${domain}`, 7000)
  if (!response?.ok) return ''
  const html = (await response.text()).slice(0, 400_000)
  const base = response.url || `https://${domain}`
  const candidates: { href: string; score: number }[] = []
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const markup = tag[0]
    const rel = /rel=["']?([^"'>]+)/i.exec(markup)?.[1]?.toLowerCase() ?? ''
    const href = /href=["']?([^"'\s>]+)/i.exec(markup)?.[1]
    if (!href || !/icon/.test(rel)) continue
    const size = Number(/sizes=["']?(\d+)/i.exec(markup)?.[1] ?? 0)
    let score = size || 32
    if (rel.includes('apple-touch-icon')) score += 1000
    if (/\.svg(\?|$)/i.test(href) || /image\/svg/i.test(markup)) score += 500
    candidates.push({ href, score })
  }
  candidates.push({ href: '/apple-touch-icon.png', score: 900 })
  for (const candidate of candidates.sort((a, b) => b.score - a.score).slice(0, 4)) {
    try {
      const url = new URL(candidate.href, base).toString()
      if (await isImage(url)) return url
    } catch {
      // Adresse d'icône malformée : on passe à la suivante.
    }
  }
  return ''
}

async function logoOf(website: string): Promise<string> {
  const fromSite = await iconFromSite(website)
  if (fromSite) return fromSite
  const google = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(website)}&sz=128`
  return (await isImage(google)) ? google : ''
}

export async function findLogo(company: string, email: string, site: string): Promise<{ website: string; logo: string }> {
  const mailDomain = email.includes('@') ? email.split('@')[1] : ''
  const explicit = hostOf(site) || (mailDomain && !GENERIC_MAIL.test(mailDomain) ? hostOf(mailDomain) : '')
  // Un site connu fait foi ; sinon on essaie les homonymes les plus probables.
  const candidates = explicit ? [explicit] : await domainsFromName(company)
  for (const website of candidates) {
    const logo = await logoOf(website)
    if (logo) return { website, logo }
  }
  return { website: candidates[0] ?? '', logo: 'none' }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await respond(response, 'logo', async () => {
    await requireActiveUser(request)
    return findLogo(
      String(request.query.company ?? '').slice(0, 200),
      String(request.query.email ?? '').slice(0, 200),
      String(request.query.website ?? '').slice(0, 300),
    )
  })
}
