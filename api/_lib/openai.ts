import { HttpError, openAiKey } from './guard.js'

/** Modèle de rédaction des présentations et propositions. */
export const GENERATION_MODEL = 'gpt-5.6-sol'
/** Modèle de transcription des enregistrements de rendez-vous. */
export const TRANSCRIPTION_MODEL = 'gpt-transcribe'

interface ResponsesOutput {
  status?: string
  error?: { message?: string } | null
  incomplete_details?: { reason?: string } | null
  output?: { type: string; content?: { type: string; text?: string }[] }[]
}

export interface GenerationOptions {
  name: string
  schema: Record<string, unknown>
  instructions: string
  input: string
  effort: 'low' | 'medium' | 'high'
  image?: string
}

const openAi = (path: string, init: RequestInit = {}) =>
  fetch(`https://api.openai.com/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${openAiKey()}`, 'Content-Type': 'application/json', ...init.headers },
  })

/**
 * Lance une génération en tâche de fond chez OpenAI et renvoie son identifiant.
 * Une présentation peut demander plusieurs minutes de réflexion : la fonction
 * serverless ne l'attend pas, le navigateur vient chercher le résultat.
 */
export async function startGeneration(options: GenerationOptions): Promise<string> {
  // Une image (le logo du client) accompagne le texte dans un même message.
  const input = options.image
    ? [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: options.input },
            { type: 'input_image', image_url: options.image, detail: 'high' },
          ],
        },
      ]
    : options.input
  const response = await openAi('responses', {
    method: 'POST',
    body: JSON.stringify({
      model: GENERATION_MODEL,
      background: true,
      store: true,
      reasoning: { effort: options.effort },
      instructions: options.instructions,
      input,
      max_output_tokens: 64_000,
      text: { format: { type: 'json_schema', name: options.name, strict: true, schema: options.schema } },
    }),
  })
  const payload = (await response.json().catch(() => null)) as (ResponsesOutput & { id?: string }) | null
  if (!response.ok || !payload?.id) {
    throw new HttpError(502, `OpenAI a refusé la génération : ${payload?.error?.message ?? response.status}`)
  }
  return payload.id
}

export type GenerationState<T> = { done: false } | { done: true; result: T }

/** État d'une génération lancée par `startGeneration`. */
export async function readGeneration<T>(id: string): Promise<GenerationState<T>> {
  if (!/^resp_[A-Za-z0-9]+$/.test(id)) throw new HttpError(400, 'Identifiant de génération invalide.')
  const response = await openAi(`responses/${id}`)
  const payload = (await response.json().catch(() => null)) as ResponsesOutput | null
  if (!response.ok || !payload) {
    throw new HttpError(502, `Suivi de la génération impossible : ${payload?.error?.message ?? response.status}`)
  }
  if (payload.status === 'queued' || payload.status === 'in_progress') return { done: false }
  if (payload.status === 'incomplete') {
    throw new HttpError(502, `Génération interrompue (${payload.incomplete_details?.reason ?? 'raison inconnue'}).`)
  }
  if (payload.status !== 'completed') {
    throw new HttpError(502, `Génération échouée : ${payload.error?.message ?? payload.status}`)
  }

  const text = payload.output
    ?.flatMap((item) => (item.type === 'message' ? (item.content ?? []) : []))
    .find((part) => part.type === 'output_text')?.text
  if (!text) throw new HttpError(502, 'Réponse vide du modèle.')
  try {
    return { done: true, result: JSON.parse(text) as T }
  } catch {
    throw new HttpError(502, 'Réponse du modèle illisible.')
  }
}

/** Génération complète en un appel : lancement puis attente du résultat. */
export async function generateJson<T>(options: GenerationOptions): Promise<T> {
  const id = await startGeneration(options)
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const state = await readGeneration<T>(id)
    if (state.done) return state.result
  }
}

export async function transcribe(audio: Buffer, filename: string, prompt: string): Promise<string> {
  const form = new FormData()
  form.append('model', TRANSCRIPTION_MODEL)
  form.append('language', 'fr')
  if (prompt) form.append('prompt', prompt)
  form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), filename)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey()}` },
    body: form,
  })
  const payload = (await response.json().catch(() => null)) as { text?: string; error?: { message?: string } } | null
  if (!response.ok) {
    throw new HttpError(502, `Transcription refusée : ${payload?.error?.message ?? response.status}`)
  }
  return payload?.text ?? ''
}

const isPrivateHost = (hostname: string) =>
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1|0\.)/i.test(hostname)

async function fetchText(url: URL, limit: number): Promise<string> {
  if (!['http:', 'https:'].includes(url.protocol) || isPrivateHost(url.hostname)) return ''
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36' },
  })
  if (!response.ok) return ''
  return (await response.text()).slice(0, limit)
}

/** Couleurs les plus présentes d'un ensemble de feuilles de style, hors noir, blanc et gris. */
function topColors(css: string): string[] {
  const counts = new Map<string, number>()
  for (const match of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let hex = match[1].toLowerCase()
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join('')
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const spread = Math.max(r, g, b) - Math.min(r, g, b)
    const key = `#${hex}`
    // Les gris comptent aussi (fonds, textes), mais moins que les teintes.
    counts.set(key, (counts.get(key) ?? 0) + (spread < 18 ? 0.35 : 1))
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([hex]) => hex)
}

function fontFamilies(html: string, css: string): string[] {
  const names = new Map<string, number>()
  const add = (name: string, weight = 1) => {
    const clean = name.trim().replace(/^['"]|['"]$/g, '').trim()
    if (/icon|icomoon|awesome|swiper|slick|material symbols|glyph/i.test(clean)) return
    if (!clean || /^(inherit|initial|unset|var\(|sans-serif|serif|monospace|system-ui|-apple-system|blinkmacsystemfont|arial|helvetica|segoe ui|roboto|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|ui-)/i.test(clean)) return
    names.set(clean, (names.get(clean) ?? 0) + weight)
  }
  for (const match of `${html} ${css}`.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&)\s]+)/gi)) {
    decodeURIComponent(match[1]).split('|').forEach((family) => add(family.split(':')[0].replace(/\+/g, ' '), 5))
  }
  for (const match of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) add(match[1].split(',')[0])
  for (const match of css.matchAll(/@font-face\s*{[^}]*font-family\s*:\s*([^;}]+)/gi)) add(match[1], 2)
  return [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name)
}

export interface WebsiteInfo {
  /** Texte de la page : offre, vocabulaire, positionnement. */
  text: string
  /** Identité graphique relevée : polices, couleurs, ton visuel. */
  identity: string
}

/**
 * Lit la page d'accueil du client et ses feuilles de style : son discours
 * nourrit le contenu, ses polices et ses couleurs exactes nourrissent la
 * direction artistique. Un site injoignable n'est jamais bloquant.
 */
export async function readWebsite(url: string): Promise<WebsiteInfo> {
  const target = url.trim()
  if (!target) return { text: '', identity: '' }
  try {
    const page = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`)
    const html = await fetchText(page, 800_000)
    if (!html) return { text: '', identity: '' }

    const pick = (pattern: RegExp) => pattern.exec(html)?.[1]?.trim() ?? ''
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    const themeColor = pick(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']*)["']/i)
    const body = html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;|&rsquo;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()

    const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')
    const sheets = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)]
      .map((tag) => /href=["']([^"']+)["']/i.exec(tag[0])?.[1])
      .filter((href): href is string => Boolean(href) && !/fonts\.googleapis/i.test(href!))
      .slice(0, 4)
    const external = await Promise.all(
      sheets.map((href) => fetchText(new URL(href, page), 600_000).catch(() => '')),
    )
    const css = [inline, ...external].join('\n')
    const styleAttrs = [...html.matchAll(/style=["']([^"']+)["']/gi)].map((m) => m[1]).join(';')

    const fonts = fontFamilies(html, css)
    const colors = topColors(`${css};${styleAttrs}`)
    const radius = [...css.matchAll(/border-radius\s*:\s*(\d+)px/gi)].map((m) => Number(m[1]))
    const avgRadius = radius.length ? Math.round(radius.reduce((a, b) => a + b, 0) / radius.length) : null
    const uppercase = (css.match(/text-transform\s*:\s*uppercase/gi) ?? []).length

    const identity = [
      fonts.length ? `Polices utilisées sur le site (de la plus présente à la moins présente) : ${fonts.join(', ')}` : '',
      colors.length ? `Couleurs les plus utilisées dans ses feuilles de style : ${colors.join(', ')}` : '',
      themeColor ? `Couleur de thème déclarée : ${themeColor}` : '',
      avgRadius !== null ? `Arrondis moyens : ${avgRadius} px (${avgRadius <= 4 ? 'angles vifs, rigueur' : avgRadius >= 16 ? 'formes douces' : 'arrondis modérés'})` : '',
      uppercase > 8 ? 'Usage marqué des capitales dans les titres ou étiquettes.' : '',
    ]
      .filter(Boolean)
      .join('\n')

    return {
      text: [title && `Titre : ${title}`, description && `Description : ${description}`, body.slice(0, 5000)].filter(Boolean).join('\n'),
      identity,
    }
  } catch {
    return { text: '', identity: '' }
  }
}
