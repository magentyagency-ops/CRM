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

/** Appelle l'API Responses avec une sortie JSON stricte et renvoie l'objet produit. */
export async function generateJson<T>(options: {
  name: string
  schema: Record<string, unknown>
  instructions: string
  input: string
  effort: 'low' | 'medium' | 'high'
}): Promise<T> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GENERATION_MODEL,
      reasoning: { effort: options.effort },
      instructions: options.instructions,
      input: options.input,
      max_output_tokens: 32_000,
      text: { format: { type: 'json_schema', name: options.name, strict: true, schema: options.schema } },
    }),
  })

  const payload = (await response.json().catch(() => null)) as ResponsesOutput | null
  if (!response.ok || !payload) {
    throw new HttpError(502, `OpenAI a refusé la génération : ${payload?.error?.message ?? response.status}`)
  }
  if (payload.status === 'incomplete') {
    throw new HttpError(502, `Génération interrompue (${payload.incomplete_details?.reason ?? 'raison inconnue'}).`)
  }

  const text = payload.output
    ?.flatMap((item) => (item.type === 'message' ? (item.content ?? []) : []))
    .find((part) => part.type === 'output_text')?.text
  if (!text) throw new HttpError(502, 'Réponse vide du modèle.')

  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(502, 'Réponse du modèle illisible.')
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

/**
 * Texte visible de la page d'accueil du client : son vocabulaire, son offre et
 * son positionnement nourrissent la personnalisation. Un site injoignable n'est
 * jamais bloquant.
 */
export async function websiteExcerpt(url: string): Promise<string> {
  const target = url.trim()
  if (!target) return ''
  try {
    const parsed = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`)
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    // Seuls les sites publics sont lus : pas d'adresse locale ni de réseau privé.
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1|0\.)/i.test(parsed.hostname)) return ''
    const response = await fetch(parsed, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NiraCRM/1.0)' },
    })
    if (!response.ok) return ''
    const html = (await response.text()).slice(0, 600_000)
    const pick = (pattern: RegExp) => pattern.exec(html)?.[1]?.trim() ?? ''
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    const body = html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;|&rsquo;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    return [title && `Titre : ${title}`, description && `Description : ${description}`, body.slice(0, 5000)]
      .filter(Boolean)
      .join('\n')
  } catch {
    return ''
  }
}
