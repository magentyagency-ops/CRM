import { supabase } from './supabase.js'
import type { Activity, AppState, CalendarEvent, Lead, Profile, Theme } from './types.js'

const now = () => new Date().toISOString()

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
    const [profilesRes, leadsRes, activitiesRes, eventsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('leads').select('*').order('createdAt', { ascending: false }),
      supabase.from('activities').select('*').order('createdAt', { ascending: false }),
      supabase.from('events').select('*').order('start', { ascending: true }),
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
      nextStep: input.nextStep?.trim() ?? '',
      expectedCloseAt: input.expectedCloseAt ?? '',
      tags: input.tags ?? [],
      notes: input.notes ?? '',
      // Un admin peut créer un lead pour un autre compte ; sinon on s'attribue le lead.
      owner_id: input.owner_id ?? (await currentUserId()),
      createdAt: stamp,
      updatedAt: stamp,
    }

    const { data: createdLead, error: leadError } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single()

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

    const { data: updatedLead, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

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
