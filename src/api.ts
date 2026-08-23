import { supabase } from './supabase.js'
import type { Activity, AppState, CalendarEvent, Call, Lead, Profile, Theme } from './types.js'

const now = () => new Date().toISOString()

/**
 * Rejoue une écriture sans la colonne `offer` si la base ne la connaît pas
 * encore : le déploiement du code et la migration 004 peuvent ainsi arriver
 * dans n'importe quel ordre sans casser la création de leads.
 */
function colonneOffreAbsente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    Boolean(error.message && error.message.includes("'offer'"))
  )
}

/** Identifiant du compte connecté : sert de propriétaire par défaut. */
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export const api = {
  /**
   * Charge tout ce que la RLS autorise pour le compte connecté : un commercial
   * ne reçoit que ses leads, un admin les reçoit tous.
   */
  async loadState(): Promise<AppState> {
    const [profilesRes, leadsRes, activitiesRes, eventsRes, callsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('leads').select('*').order('createdAt', { ascending: false }),
      supabase.from('activities').select('*').order('createdAt', { ascending: false }),
      supabase.from('events').select('*').order('start', { ascending: true }),
      supabase.from('calls').select('*').order('date', { ascending: false }),
    ])

    if (leadsRes.error) {
      console.error('Erreur chargement leads Supabase:', leadsRes.error)
      throw new Error(`Erreur Supabase: ${leadsRes.error.message}`)
    }

    const userId = await currentUserId()
    const members = ((profilesRes.data || []) as Profile[]).filter((member) => member.active)
    const profile = members.find((member) => member.id === userId) ?? null
    const theme: Theme = profile?.theme ?? 'light'
    const activities = (activitiesRes.data || []) as (Activity & { leadId: string })[]
    const events = (eventsRes.data || []) as CalendarEvent[]
    // La table des appels arrive avec la migration 005 : tant qu'elle n'est pas
    // jouée, le reste de l'application doit continuer à se charger.
    if (callsRes.error) console.warn('[crm] table des appels indisponible', callsRes.error.message)
    const calls = (callsRes.data || []) as Call[]

    const leads: Lead[] = (leadsRes.data || []).map((lead: any) => ({
      ...lead,
      value: Number(lead.value) || 0,
      probability: Number(lead.probability) || 0,
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      activities: activities
        .filter((act) => act.leadId === lead.id)
        .map(({ leadId: _unused, ...act }) => act),
    }))

    return {
      theme,
      leads,
      events,
      calls,
      profile,
      members,
      ownerFilter: [],
    }
  },

  async saveTheme(theme: Theme): Promise<{ theme: Theme }> {
    const userId = await currentUserId()
    if (!userId) return { theme }

    // Le thème est propre à chaque compte : il vit dans son profil.
    const { error } = await supabase.from('profiles').update({ theme }).eq('id', userId)
    if (error) {
      console.error('Erreur sauvegarde thème:', error)
      throw new Error(error.message)
    }

    return { theme }
  },

  async createLead(input: Partial<Lead>): Promise<Lead> {
    const stamp = now()
    const id = crypto.randomUUID()
    const leadData = {
      id,
      contact: input.contact?.trim() || 'Nouveau contact',
      company: input.company?.trim() ?? '',
      email: input.email?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      role: input.role?.trim() ?? '',
      source: input.source?.trim() ?? 'Direct',
      owner: input.owner?.trim() ?? '',
      stage: input.stage ?? 'new',
      value: Number.isFinite(input.value) ? Number(input.value) : 0,
      probability: Number.isFinite(input.probability) ? Number(input.probability) : 10,
      priority: input.priority ?? 'medium',
      offer: input.offer ?? '',
      nextStep: input.nextStep?.trim() ?? '',
      expectedCloseAt: input.expectedCloseAt ?? '',
      tags: input.tags ?? [],
      notes: input.notes ?? '',
      // Un admin peut créer un lead pour un autre compte ; sinon on s'attribue le lead.
      owner_id: input.owner_id ?? (await currentUserId()),
      createdAt: stamp,
      updatedAt: stamp,
    }

    let { data: createdLead, error: leadError } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single()

    if (colonneOffreAbsente(leadError)) {
      const { offer: _sansOffre, ...donneesSansOffre } = leadData
      ;({ data: createdLead, error: leadError } = await supabase
        .from('leads')
        .insert(donneesSansOffre)
        .select()
        .single())
    }

    if (leadError) throw new Error(leadError.message)

    const initialActivity = {
      id: crypto.randomUUID(),
      leadId: id,
      kind: 'stage' as const,
      text: 'Lead créé.',
      createdAt: stamp,
    }

    await supabase.from('activities').insert(initialActivity)

    return {
      ...createdLead,
      value: Number(createdLead.value) || 0,
      probability: Number(createdLead.probability) || 0,
      tags: Array.isArray(createdLead.tags) ? createdLead.tags : [],
      activities: [{ id: initialActivity.id, kind: initialActivity.kind, text: initialActivity.text, createdAt: initialActivity.createdAt }],
    }
  },

  async updateLead(id: string, input: Partial<Lead>): Promise<Lead> {
    const stamp = now()

    // Vérifier l'étape précédente pour consigner l'activité si elle change
    if (input.stage) {
      const { data: existing } = await supabase
        .from('leads')
        .select('stage')
        .eq('id', id)
        .single()

      if (existing && existing.stage !== input.stage) {
        await supabase.from('activities').insert({
          id: crypto.randomUUID(),
          leadId: id,
          kind: 'stage',
          text: `Étape : ${existing.stage} → ${input.stage}.`,
          createdAt: stamp,
        })
      }
    }

    const updatePayload: Record<string, unknown> = {
      ...input,
      updatedAt: stamp,
    }
    delete updatePayload.activities
    delete updatePayload.id
    delete updatePayload.createdAt

    let { data: updatedLead, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (colonneOffreAbsente(error)) {
      delete updatePayload.offer
      ;({ data: updatedLead, error } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single())
    }

    if (error) throw new Error(error.message)

    // Récupérer les activités du lead
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('leadId', id)
      .order('createdAt', { ascending: false })

    return {
      ...updatedLead,
      value: Number(updatedLead.value) || 0,
      probability: Number(updatedLead.probability) || 0,
      tags: Array.isArray(updatedLead.tags) ? updatedLead.tags : [],
      activities: (activities || []).map(({ leadId: _unused, ...a }) => a),
    }
  },

  async deleteLead(id: string): Promise<void> {
    // 1. Supprimer le lead (les activités sont supprimées en cascade grâce à la clé étrangère SQL)
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw new Error(error.message)

    // 2. Dissocier les événements associés
    await supabase.from('events').update({ leadId: null }).eq('leadId', id)
  },

  async addActivity(id: string, input: Pick<Activity, 'kind' | 'text'>): Promise<Lead> {
    const stamp = now()
    const activityData = {
      id: crypto.randomUUID(),
      leadId: id,
      kind: input.kind,
      text: input.text,
      createdAt: stamp,
    }

    const { error: actError } = await supabase.from('activities').insert(activityData)
    if (actError) throw new Error(actError.message)

    await supabase.from('leads').update({ updatedAt: stamp }).eq('id', id)

    // Retourner le lead actualisé
    const [{ data: lead }, { data: activities }] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('activities').select('*').eq('leadId', id).order('createdAt', { ascending: false }),
    ])

    if (!lead) throw new Error('Lead introuvable.')

    return {
      ...lead,
      value: Number(lead.value) || 0,
      probability: Number(lead.probability) || 0,
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      activities: (activities || []).map(({ leadId: _unused, ...a }) => a),
    }
  },

  /* ------------------------------------------------------- suivi d'appels */

  /** Valeurs par défaut d'un appel : tout ce que la base attend, jamais `undefined`. */
  async createCall(input: Partial<Call>): Promise<Call> {
    const stamp = now()
    const meeting = input.meeting ?? false
    const callData = {
      id: crypto.randomUUID(),
      date: input.date || stamp.slice(0, 10),
      contact: input.contact?.trim() ?? '',
      company: input.company?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      outcome: input.outcome ?? 'no-answer',
      conversation: input.conversation ?? false,
      meeting,
      meetingAt: input.meetingAt ?? '',
      // Un rendez-vous obtenu rend la raison de refus sans objet.
      reason: meeting ? '' : (input.reason ?? ''),
      objection: input.objection ?? '',
      notes: input.notes ?? '',
      nextAction: input.nextAction?.trim() ?? '',
      followUpAt: input.followUpAt ?? '',
      leadId: input.leadId ?? null,
      owner_id: input.owner_id ?? (await currentUserId()),
      createdAt: stamp,
      updatedAt: stamp,
    }

    const { data: created, error } = await supabase.from('calls').insert(callData).select().single()
    if (error) throw new Error(error.message)
    return created as Call
  },

  async updateCall(id: string, input: Partial<Call>): Promise<Call> {
    const updatePayload: Record<string, unknown> = { ...input, updatedAt: now() }
    delete updatePayload.id
    delete updatePayload.createdAt
    if (input.meeting) updatePayload.reason = ''

    const { data: updated, error } = await supabase
      .from('calls')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return updated as Call
  },

  async deleteCall(id: string): Promise<void> {
    const { error } = await supabase.from('calls').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async createEvent(input: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const stamp = now()
    const start = input.start ?? stamp
    const eventData = {
      id: crypto.randomUUID(),
      title: input.title?.trim() || 'Rendez-vous',
      kind: input.kind ?? 'meeting',
      start,
      end: input.end ?? new Date(new Date(start).getTime() + 45 * 60_000).toISOString(),
      leadId: input.leadId ?? null,
      location: input.location?.trim() ?? '',
      notes: input.notes ?? '',
      done: input.done ?? false,
      owner_id: input.owner_id ?? (await currentUserId()),
      createdAt: stamp,
      updatedAt: stamp,
    }

    const { data: created, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return created as CalendarEvent
  },

  async updateEvent(id: string, input: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const updatePayload = {
      ...input,
      updatedAt: now(),
    }
    delete (updatePayload as any).id
    delete (updatePayload as any).createdAt

    const { data: updated, error } = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return updated as CalendarEvent
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
