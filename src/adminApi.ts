import { accessToken } from './auth.js'
import type { Member, MemberStats, Role } from './types.js'

/**
 * Client de la fonction serverless `/api/admin/users`.
 * Toutes ces opérations sont refusées côté serveur si l'appelant n'est pas admin.
 */

async function request<T>(method: string, body?: unknown): Promise<T> {
  const token = await accessToken()
  const response = await fetch('/api/admin/users', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error ?? `Requête refusée (${response.status}).`)
  }
  return payload as T
}

export interface CreateMemberInput {
  email: string
  password: string
  full_name: string
  role: Role
}

export const adminApi = {
  list: () => request<{ members: Member[]; unassigned: MemberStats | null }>('GET'),

  create: (input: CreateMemberInput) => request<{ member: Member }>('POST', input),

  update: (input: { id: string; full_name?: string; role?: Role; active?: boolean; password?: string }) =>
    request<{ member: Member | null }>('PATCH', input),

  remove: (input: { id: string; reassignTo?: string }) =>
    request<{ deleted: string; reassignedTo: string }>('DELETE', input),
}
