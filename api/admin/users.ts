import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Administration des comptes.
 *
 * Cette fonction est le SEUL endroit qui manipule la clé `service_role` : elle ne
 * doit jamais être exposée au navigateur. Chaque appel est authentifié avec le
 * jeton du compte appelant, puis autorisé en relisant son rôle en base.
 */

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const admin = (): SupabaseClient =>
  createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

interface Caller {
  id: string
  email: string
}

async function authorize(request: VercelRequest): Promise<Caller> {
  const header = request.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new HttpError(401, 'Jeton manquant.')

  const client = admin()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Session invalide.')

  const { data: profile } = await client
    .from('profiles')
    .select('role, active')
    .eq('id', data.user.id)
    .single()

  if (!profile?.active) throw new HttpError(403, 'Compte désactivé.')
  if (profile.role !== 'admin') throw new HttpError(403, 'Réservé aux administrateurs.')

  return { id: data.user.id, email: data.user.email ?? '' }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/* ------------------------------------------------------------------ actions */

async function listMembers(): Promise<unknown> {
  const client = admin()
  const [{ data: profiles, error }, { data: leads }] = await Promise.all([
    client.from('profiles').select('*').order('created_at', { ascending: true }),
    client.from('leads').select('owner_id, stage, value, updatedAt'),
  ])
  if (error) throw new HttpError(500, error.message)

  const stats = new Map<string, { leads: number; open: number; openValue: number; wonValue: number; lastActivity: string }>()
  for (const lead of leads ?? []) {
    const key = (lead as { owner_id: string | null }).owner_id ?? 'unassigned'
    const entry = stats.get(key) ?? { leads: 0, open: 0, openValue: 0, wonValue: 0, lastActivity: '' }
    const stage = (lead as { stage: string }).stage
    const value = Number((lead as { value: number }).value) || 0
    entry.leads += 1
    if (stage !== 'won' && stage !== 'lost') {
      entry.open += 1
      entry.openValue += value
    }
    if (stage === 'won') entry.wonValue += value
    const updated = String((lead as { updatedAt: string }).updatedAt ?? '')
    if (updated > entry.lastActivity) entry.lastActivity = updated
    stats.set(key, entry)
  }

  return {
    members: (profiles ?? []).map((profile) => ({
      ...profile,
      stats: stats.get((profile as { id: string }).id) ?? {
        leads: 0,
        open: 0,
        openValue: 0,
        wonValue: 0,
        lastActivity: '',
      },
    })),
    unassigned: stats.get('unassigned') ?? null,
  }
}

async function createMember(body: Record<string, unknown>): Promise<unknown> {
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const fullName = String(body.full_name ?? '').trim()
  const role = body.role === 'admin' ? 'admin' : 'user'

  if (!email.includes('@')) throw new HttpError(400, 'Email invalide.')
  if (password.length < 8) throw new HttpError(400, 'Le mot de passe doit faire au moins 8 caractères.')

  const client = admin()
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) throw new HttpError(400, error?.message ?? "Création impossible.")

  // Le trigger a créé le profil ; on applique ensuite le rôle voulu par l'admin.
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .upsert({ id: data.user.id, email, full_name: fullName, role, active: true })
    .select()
    .single()
  if (profileError) throw new HttpError(500, profileError.message)

  return { member: profile }
}

async function updateMember(body: Record<string, unknown>, caller: Caller): Promise<unknown> {
  const id = String(body.id ?? '')
  if (!id) throw new HttpError(400, 'Compte manquant.')

  const client = admin()
  const patch: Record<string, unknown> = {}
  if (typeof body.full_name === 'string') patch.full_name = body.full_name.trim()
  if (body.role === 'admin' || body.role === 'user') patch.role = body.role
  if (typeof body.active === 'boolean') patch.active = body.active

  if (id === caller.id && (patch.role === 'user' || patch.active === false)) {
    throw new HttpError(400, 'Tu ne peux pas retirer tes propres droits administrateur.')
  }

  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 8) throw new HttpError(400, 'Le mot de passe doit faire au moins 8 caractères.')
    const { error } = await client.auth.admin.updateUserById(id, { password: body.password })
    if (error) throw new HttpError(400, error.message)
  }

  if (Object.keys(patch).length === 0) return { member: null }

  const { data, error } = await client.from('profiles').update(patch).eq('id', id).select().single()
  if (error) throw new HttpError(500, error.message)
  return { member: data }
}

async function deleteMember(body: Record<string, unknown>, caller: Caller): Promise<unknown> {
  const id = String(body.id ?? '')
  const reassignTo = body.reassignTo ? String(body.reassignTo) : null
  if (!id) throw new HttpError(400, 'Compte manquant.')
  if (id === caller.id) throw new HttpError(400, 'Tu ne peux pas supprimer ton propre compte.')

  const client = admin()

  // Les leads sont transférés (ou rattachés à l'admin appelant) avant la suppression,
  // pour qu'aucune donnée commerciale ne disparaisse avec le compte.
  const target = reassignTo ?? caller.id
  await client.from('leads').update({ owner_id: target }).eq('owner_id', id)
  await client.from('events').update({ owner_id: target }).eq('owner_id', id)

  const { error } = await client.auth.admin.deleteUser(id)
  if (error) throw new HttpError(400, error.message)

  return { deleted: id, reassignedTo: target }
}

/* ----------------------------------------------------------------- handler */

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({
      error:
        "Configuration serveur incomplète : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans les variables d'environnement Vercel.",
    })
    return
  }

  try {
    const caller = await authorize(request)
    const body = (typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body) ?? {}

    switch (request.method) {
      case 'GET':
        response.status(200).json(await listMembers())
        return
      case 'POST':
        response.status(201).json(await createMember(body))
        return
      case 'PATCH':
        response.status(200).json(await updateMember(body, caller))
        return
      case 'DELETE':
        response.status(200).json(await deleteMember(body, caller))
        return
      default:
        response.setHeader('Allow', 'GET, POST, PATCH, DELETE')
        response.status(405).json({ error: 'Méthode non autorisée.' })
    }
  } catch (error) {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    console.error('[admin/users]', error)
    response.status(500).json({ error: 'Erreur serveur.' })
  }
}
