import { accessToken } from '../auth.js'
import { supabase } from '../supabase.js'
import type {
  Brand,
  Brief,
  Deck,
  GenerateStep,
  GeneratedContent,
  ProposalDoc,
  ProposalRecord,
  StudioInput,
  TechDoc,
} from './model.js'
import { renderDeck } from './render/deck.js'
import { renderProposal, renderTechDoc } from './render/documents.js'

/* ------------------------------------------------------------ génération */

async function generateStep<T>(step: GenerateStep, input: StudioInput, brief?: Brief): Promise<T> {
  let lastError: Error | null = null
  // Une génération longue peut échouer sur un aléa réseau : un seul nouvel essai.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, input, brief }),
      })
      const payload = await response.json().catch(() => null)
      if (response.ok && payload?.result) return payload.result as T
      lastError = new Error(payload?.error ?? `Génération refusée (${response.status}).`)
      if (response.status < 500) break
    } catch (error) {
      lastError = error as Error
    }
  }
  throw lastError ?? new Error('Génération impossible.')
}

export type StepState = 'pending' | 'running' | 'done' | 'error'

export async function generateContent(
  input: StudioInput,
  onStep: (step: GenerateStep, state: StepState) => void,
): Promise<GeneratedContent> {
  onStep('brief', 'running')
  const brief = await generateStep<Brief>('brief', input).catch((error) => {
    onStep('brief', 'error')
    throw error
  })
  onStep('brief', 'done')

  const track = <T>(step: GenerateStep, task: Promise<T>) => {
    onStep(step, 'running')
    return task.then(
      (value) => {
        onStep(step, 'done')
        return value
      },
      (error) => {
        onStep(step, 'error')
        throw error
      },
    )
  }

  const [deck, proposal, techdoc] = await Promise.all([
    track('deck', generateStep<Deck>('deck', input, brief)),
    track('proposal', generateStep<ProposalDoc>('proposal', input, brief)),
    input.includeTechDoc ? track('techdoc', generateStep<TechDoc>('techdoc', input, brief)) : Promise.resolve(null),
  ])

  return { brief, deck, proposal, techdoc }
}

/* ------------------------------------------------------------ historique */

const tableMissing = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205'

export async function listProposals(leadId: string): Promise<ProposalRecord[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('leadId', leadId)
    .order('createdAt', { ascending: false })
  if (error) {
    if (!tableMissing(error)) console.warn('[proposals] lecture impossible', error.message)
    return []
  }
  return (data ?? []) as ProposalRecord[]
}

export async function saveProposal(
  leadId: string,
  input: StudioInput,
  brand: Brand,
  content: GeneratedContent,
): Promise<ProposalRecord> {
  const record = {
    id: crypto.randomUUID(),
    leadId,
    input,
    brand,
    content,
    createdAt: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('proposals').insert(record).select().single()
  if (error) {
    throw new Error(
      tableMissing(error)
        ? "Documents générés mais non enregistrés : exécute supabase/008-propositions.sql dans Supabase."
        : `Documents générés mais non enregistrés : ${error.message}`,
    )
  }
  return data as ProposalRecord
}

export async function deleteProposal(id: string): Promise<void> {
  const { error } = await supabase.from('proposals').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* ------------------------------------------------------------ documents */

export type DocKind = 'deck' | 'proposal' | 'techdoc'

export const DOC_KINDS: Record<DocKind, { label: string; icon: string; file: string }> = {
  deck: { label: 'Présentation', icon: 'ri-slideshow-3-line', file: 'presentation' },
  proposal: { label: 'Proposition commerciale', icon: 'ri-file-text-line', file: 'proposition' },
  techdoc: { label: 'Documentation technique', icon: 'ri-tools-line', file: 'documentation-technique' },
}

type Renderable = Pick<ProposalRecord, 'input' | 'brand' | 'content'>

export function renderDoc(kind: DocKind, record: Renderable): string {
  if (kind === 'deck') return renderDeck(record.content, record.brand, record.input)
  if (kind === 'proposal') return renderProposal(record.content, record.brand, record.input)
  return renderTechDoc(record.content, record.brand, record.input)
}

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

/** Ouvre le document dans un nouvel onglet ; `print` lance directement l'export PDF. */
export function openDoc(kind: DocKind, record: Renderable, print = false): void {
  const url = URL.createObjectURL(new Blob([renderDoc(kind, record)], { type: 'text/html' }))
  window.open(print ? `${url}#print` : url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function downloadDoc(kind: DocKind, record: Renderable): void {
  const url = URL.createObjectURL(new Blob([renderDoc(kind, record)], { type: 'text/html' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${DOC_KINDS[kind].file}-${slug(record.input.company) || 'client'}.html`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
