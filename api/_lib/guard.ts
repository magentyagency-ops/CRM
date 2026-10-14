import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Garde commune aux fonctions ouvertes à tous les comptes actifs (et pas
 * seulement aux administrateurs) : elles consomment des crédits OpenAI, elles
 * ne doivent donc jamais répondre à un appel anonyme.
 *
 * Le jeton est vérifié avec la clé publique `anon` : le profil est relu sous
 * l'identité de l'appelant, la RLS lui laissant lire le sien.
 */

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://bmguarnqwgqhzhcigdmj.supabase.co'
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZ3Vhcm5xd2dxaHpoY2lnZG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMDc0MTIsImV4cCI6MjEwMjU4MzQxMn0.GPxGdpr_Q1rH2OG3GUuQBoQkcPbid81ZNzUElEa9_ow'

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export async function requireActiveUser(request: VercelRequest): Promise<{ id: string; email: string }> {
  const header = request.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new HttpError(401, 'Jeton manquant.')

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Session invalide, reconnecte-toi.')

  const { data: profile } = await client.from('profiles').select('active').eq('id', data.user.id).maybeSingle()
  if (!profile?.active) throw new HttpError(403, 'Compte désactivé.')

  return { id: data.user.id, email: data.user.email ?? '' }
}

export function openAiKey(): string {
  const key = process.env.OPENAI_API_KEY ?? ''
  if (!key) {
    throw new HttpError(
      500,
      "Configuration serveur incomplète : OPENAI_API_KEY doit être définie dans les variables d'environnement Vercel.",
    )
  }
  return key
}

/** Exécute un handler en traduisant les erreurs en réponses JSON lisibles. */
export async function respond(
  response: VercelResponse,
  label: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    response.status(200).json(await run())
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    console.error(`[${label}]`, error)
    response.status(500).json({ error: (error as Error).message || 'Erreur serveur.' })
  }
}
