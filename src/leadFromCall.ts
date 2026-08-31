import { api } from './api.js'
import { state, upsertCall, upsertLead } from './store.js'
import type { Call, Lead } from './types.js'
import { formatDate, stageMeta, toast } from './ui.js'

/**
 * Un rendez-vous décroché au téléphone n'est plus de la prospection : c'est une
 * opportunité. Ce module fait le pont entre le suivi d'appels et le pipeline —
 * il est appelé depuis la ligne d'ajout, l'édition en cellule et la fiche
 * d'appel, pour que la règle soit la même partout.
 */

/** Étapes qu'un rendez-vous fait rouvrir ; ailleurs, le lead est déjà en piste. */
const A_PROMOUVOIR = ['lost'] as const

/** Lead déjà relié à l'appel, ou à défaut celui de la même société du même compte. */
function leadExistant(call: Call): Lead | undefined {
  if (call.leadId) {
    const relie = state.leads.find((lead) => lead.id === call.leadId)
    if (relie) return relie
  }

  const societe = call.company.trim().toLowerCase()
  if (!societe) return undefined
  // Un admin voit les leads de toute l'équipe : on ne raccroche jamais un appel
  // à l'opportunité d'un autre commercial.
  return state.leads.find(
    (lead) => lead.company.trim().toLowerCase() === societe && lead.owner_id === call.owner_id,
  )
}

/**
 * Reflète un rendez-vous obtenu dans le pipeline : le lead concerné passe en
 * « Qualifié », ou est créé à cette étape s'il n'existe pas encore. L'appel
 * garde le lien vers l'opportunité. Sans rendez-vous, rien n'est écrit.
 */
export async function syncMeetingToPipeline(call: Call): Promise<Call> {
  if (!call.meeting) return call

  const etape = stageMeta('qualified')
  const quand = call.meetingAt ? ` du ${formatDate(call.meetingAt)}` : ''
  const historique = `Rendez-vous obtenu au téléphone${quand}.`

  try {
    const existant = leadExistant(call)
    let lead: Lead

    if (existant) {
      // Un lead déjà en proposition ou en négociation ne redescend pas d'un cran.
      lead = (A_PROMOUVOIR as readonly string[]).includes(existant.stage)
        ? await api.updateLead(existant.id, { stage: 'qualified', probability: etape.probability })
        : existant
      lead = await api.addActivity(lead.id, { kind: 'meeting', text: historique })
      toast(
        lead.stage === 'qualified' && existant.stage !== 'qualified'
          ? `${lead.company || lead.contact} passe en Qualifié.`
          : `Rendez-vous ajouté à ${lead.company || lead.contact}.`,
      )
    } else {
      const cree = await api.createLead({
        company: call.company || call.contact,
        contact: call.contact,
        phone: call.phone,
        source: 'Cold call',
        stage: 'qualified',
        probability: etape.probability,
        nextStep: call.meetingAt ? `Rendez-vous le ${formatDate(call.meetingAt)}` : 'Rendez-vous à programmer',
        notes: call.notes,
        owner_id: call.owner_id,
      })
      lead = await api.addActivity(cree.id, { kind: 'meeting', text: historique })
      toast(`${lead.company || 'Nouveau lead'} ajouté au pipeline en Qualifié.`)
    }

    upsertLead(lead)

    if (call.leadId === lead.id) return call
    const relie = await api.updateCall(call.id, { leadId: lead.id })
    upsertCall(relie)
    return relie
  } catch (error) {
    // L'appel, lui, est bien enregistré : on signale l'échec sans le perdre.
    toast(`Rendez-vous enregistré, mais le pipeline n'a pas suivi : ${(error as Error).message}`, 'error')
    return call
  }
}
