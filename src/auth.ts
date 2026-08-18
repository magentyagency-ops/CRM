import { supabase } from './supabase.js'
import type { Profile } from './types.js'

/**
 * Session et profil du compte connecté.
 *
 * Le cloisonnement des données est assuré par la RLS Supabase : le client ne
 * fait que refléter ce que le serveur autorise. Le rôle lu ici sert uniquement
 * à afficher ou masquer l'interface d'administration.
 */

export async function currentProfile(): Promise<Profile | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw new Error(`Session illisible : ${sessionError.message}`)
  const user = sessionData.session?.user
  if (!user) return null

  console.info('[auth] session active', { userId: user.id, email: user.email })

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (error) {
    console.error('[auth] lecture du profil refusée', error)
    throw new Error(`Profil illisible (${error.code ?? 'erreur'}) : ${error.message}`)
  }
  if (!data) {
    // Session valide mais aucun profil : le déclencheur n'a pas créé la ligne.
    // On ne déconnecte pas : la déconnexion relancerait le démarrage et effacerait
    // le message affiché juste après.
    console.error('[auth] aucun profil pour', user.id, user.email)
    throw new Error(
      `Aucun profil n'est associé à ${user.email}. Exécute supabase/003-reparation-profils.sql dans Supabase.`,
    )
  }
  if (!data.active) {
    console.warn('[auth] compte désactivé', user.email)
    throw new Error('Ce compte est désactivé. Contacte un administrateur.')
  }
  return data as Profile
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    throw new Error(
      error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message,
    )
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  })
  if (error) throw new Error(error.message)
}

export async function updateOwnPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)
}

/** Jeton d'accès à transmettre aux fonctions serverless d'administration. */
export async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Session expirée, reconnecte-toi.')
  return token
}

export function onAuthChange(listener: () => void): void {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') listener()
  })
}
