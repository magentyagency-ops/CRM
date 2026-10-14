import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Brief, GenerateStep, StudioInput } from '../../src/proposals/model.js'
import { HttpError, requireActiveUser, respond } from '../_lib/guard.js'
import { generateJson, websiteExcerpt } from '../_lib/openai.js'
import { SCHEMAS, buildPrompt } from '../_lib/proposalSpec.js'

/**
 * Génère une étape du dossier commercial d'un prospect.
 *
 * Le navigateur appelle d'abord l'étape `brief` (analyse du besoin), puis les
 * étapes `deck`, `proposal` et `techdoc` en parallèle avec cette analyse : les
 * trois documents partagent ainsi le même périmètre et les mêmes prix.
 */

export const config = { maxDuration: 300 }

const STEPS: GenerateStep[] = ['brief', 'deck', 'proposal', 'techdoc']

function readInput(raw: unknown): StudioInput {
  const value = (raw ?? {}) as Partial<StudioInput>
  const text = (field: unknown, max: number) => String(field ?? '').slice(0, max)
  const billing = (value.billing ?? {}) as Partial<StudioInput['billing']>
  const seller = (value.seller ?? {}) as Partial<StudioInput['seller']>
  if (!text(value.company, 200).trim()) throw new HttpError(400, 'Société manquante.')

  return {
    company: text(value.company, 200),
    contact: text(value.contact, 200),
    contactRole: text(value.contactRole, 200),
    sale: value.sale === 'logiciel' || value.sale === 'audit-logiciel' ? value.sale : 'audit',
    offerDescription: text(value.offerDescription, 6000),
    price: Math.max(0, Number(value.price) || 0),
    includeTechDoc: Boolean(value.includeTechDoc),
    specialRequest: text(value.specialRequest, 6000),
    website: text(value.website, 500),
    // Environ trois heures de réunion : au-delà, la transcription est tronquée.
    transcript: text(value.transcript, 200_000),
    leadNotes: text(value.leadNotes, 20_000),
    billing: {
      legalName: text(billing.legalName, 300),
      siret: text(billing.siret, 40),
      address: text(billing.address, 300),
      postalCity: text(billing.postalCity, 200),
      signatory: text(billing.signatory, 200),
      signatoryRole: text(billing.signatoryRole, 200),
      paymentTerms: text(billing.paymentTerms, 1000),
    },
    seller: { name: text(seller.name, 200), email: text(seller.email, 200) },
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Méthode non autorisée.' })
    return
  }

  await respond(response, 'proposals/generate', async () => {
    await requireActiveUser(request)
    const body = (typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body) ?? {}

    const step = body.step as GenerateStep
    if (!STEPS.includes(step)) throw new HttpError(400, 'Étape inconnue.')
    const input = readInput(body.input)
    const brief = step === 'brief' ? null : ((body.brief ?? null) as Brief | null)
    if (step !== 'brief' && !brief) throw new HttpError(400, "L'analyse du besoin est requise.")

    const website = step === 'brief' || step === 'deck' ? await websiteExcerpt(input.website) : ''
    const prompt = buildPrompt(step, input, brief, website)
    const result = await generateJson({ name: step, schema: SCHEMAS[step], ...prompt })
    return { step, result }
  })
}
