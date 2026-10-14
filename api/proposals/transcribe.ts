import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireActiveUser, respond } from '../_lib/guard.js'
import { transcribe } from '../_lib/openai.js'

/**
 * Transcrit un segment d'enregistrement.
 *
 * Le navigateur découpe chaque enregistrement en segments WAV mono 16 kHz de
 * moins de deux minutes : chacun tient sous la limite de 4,5 Mo d'une requête
 * Vercel, quelle que soit la durée du rendez-vous.
 */

export const config = { maxDuration: 120 }

async function rawBody(request: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(request.body)) return request.body
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Méthode non autorisée.' })
    return
  }

  await respond(response, 'proposals/transcribe', async () => {
    await requireActiveUser(request)
    const audio = await rawBody(request)
    if (audio.length < 1000) throw new HttpError(400, 'Segment audio vide.')

    // Le nom de la société aide le modèle à orthographier les noms propres.
    const hint = String(request.headers['x-transcript-hint'] ?? '')
    const text = await transcribe(audio, 'segment.wav', decodeURIComponent(hint).slice(0, 400))
    return { text }
  })
}
