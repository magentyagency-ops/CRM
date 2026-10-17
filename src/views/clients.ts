import { openLeadDrawer } from '../drawer.js'
import { openLeadForm } from '../forms.js'
import { closeModal, isModalOpen, openModal } from '../modal.js'
import { state, subscribe } from '../store.js'
import { supabase } from '../supabase.js'
import type { Lead } from '../types.js'
import {
  $,
  OFFERS,
  emptyBlock,
  escapeHtml,
  formatDate,
  formatMoney,
  stageMeta,
  toast,
  viewIsActive,
} from '../ui.js'

/**
 * Clients : les entreprises ayant signé au moins une vente.
 *
 * Un même client peut acheter plusieurs fois : chaque vente reste un lead du
 * pipeline, et la fiche client les rassemble avec ses documents (contrats,
 * devis, factures…), déposés dans un espace de stockage privé.
 */

export interface Client {
  key: string
  name: string
  website: string
  contact: string
  leads: Lead[]
  won: Lead[]
  wonValue: number
  openValue: number
  lastWonAt: string
}

export type DocCategory = 'contract' | 'quote' | 'invoice' | 'proposal' | 'other'

export const DOC_CATEGORIES: Record<DocCategory, { label: string; icon: string }> = {
  contract: { label: 'Contrat', icon: 'ri-file-shield-2-line' },
  quote: { label: 'Devis', icon: 'ri-file-list-3-line' },
  invoice: { label: 'Facture', icon: 'ri-bill-line' },
  proposal: { label: 'Proposition', icon: 'ri-file-text-line' },
  other: { label: 'Autre', icon: 'ri-file-line' },
}

interface ClientDocument {
  id: string
  company_key: string
  leadId: string | null
  name: string
  category: DocCategory
  path: string
  size: number
  mime: string
  createdAt: string
}

const BUCKET = 'client-documents'

/** Même normalisation que la base (migration 009) : la clé d'un client. */
export const companyKey = (company: string): string => company.trim().replace(/\s+/g, ' ').toLowerCase()

export function listClients(): Client[] {
  const groups = new Map<string, Lead[]>()
  for (const lead of state.leads) {
    if (!lead.company.trim()) continue
    const key = companyKey(lead.company)
    groups.set(key, [...(groups.get(key) ?? []), lead])
  }
  const clients: Client[] = []
  for (const [key, leads] of groups) {
    const won = leads.filter((lead) => lead.stage === 'won')
    if (!won.length) continue
    clients.push({
      key,
      name: won[0].company.trim(),
      website: leads.find((lead) => lead.website)?.website ?? '',
      contact: won[0].contact,
      leads: [...leads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      won,
      wonValue: won.reduce((sum, lead) => sum + lead.value, 0),
      openValue: leads.filter((lead) => lead.stage !== 'won' && lead.stage !== 'lost').reduce((sum, lead) => sum + lead.value, 0),
      lastWonAt: won.map((lead) => lead.updatedAt).sort().at(-1) ?? '',
    })
  }
  return clients.sort((a, b) => b.lastWonAt.localeCompare(a.lastWonAt))
}

/* ------------------------------------------------------------ documents */

const tableMissing = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205'

async function listDocuments(key: string): Promise<ClientDocument[] | null> {
  const { data, error } = await supabase
    .from('client_documents')
    .select('*')
    .eq('company_key', key)
    .order('createdAt', { ascending: false })
  if (error) {
    if (tableMissing(error)) return null
    toast(`Documents illisibles : ${error.message}`, 'error')
    return []
  }
  return (data ?? []) as ClientDocument[]
}

const safeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(-120)

async function uploadDocument(key: string, file: File, category: DocCategory, leadId: string | null): Promise<void> {
  if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} dépasse 50 Mo.`)
  const path = `${key.replace(/[^a-z0-9]+/g, '-') || 'client'}/${crypto.randomUUID()}-${safeName(file.name)}`
  // La ligne d'abord : c'est elle qui autorise l'envoi du fichier (voir la migration 009).
  const { data: row, error } = await supabase
    .from('client_documents')
    .insert({ company_key: key, leadId, name: file.name, category, path, size: file.size, mime: file.type })
    .select()
    .single()
  if (error) {
    throw new Error(tableMissing(error) ? 'Exécute supabase/009-logos-clients.sql dans Supabase pour activer les documents.' : error.message)
  }
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (uploadError) {
    await supabase.from('client_documents').delete().eq('id', (row as ClientDocument).id)
    throw new Error(`Envoi de ${file.name} impossible : ${uploadError.message}`)
  }
}

async function removeDocument(doc: ClientDocument): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([doc.path])
  if (error) throw new Error(error.message)
  const { error: rowError } = await supabase.from('client_documents').delete().eq('id', doc.id)
  if (rowError) throw new Error(rowError.message)
}

async function openDocument(doc: ClientDocument, download: boolean): Promise<void> {
  // Le lien est signé et éphémère : le fichier reste privé.
  const tab = download ? null : window.open('', '_blank')
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.path, 120, download ? { download: doc.name } : undefined)
  if (error || !data) {
    tab?.close()
    toast(error?.message ?? 'Document introuvable.', 'error')
    return
  }
  if (tab) tab.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}

/* ---------------------------------------------------------------- liste */

let search = ''

export function initClients(): void {
  const input = document.querySelector<HTMLInputElement>('#clientSearch')
  input?.addEventListener('input', () => {
    search = input.value.trim().toLowerCase()
    render()
  })
  subscribe(() => {
    render()
    if (openKey && isModalOpen() && document.querySelector(`#modalPanel [data-client="${CSS.escape(openKey)}"]`)) {
      void renderClient(openKey, false)
    }
  })
  render()
}

export function renderClientsList(): void {
  render()
}

function render(): void {
  if (!viewIsActive('leads')) return
  const grid = document.querySelector<HTMLElement>('#clientGrid')
  if (!grid || grid.closest('[hidden]')) return
  const clients = listClients().filter(
    (client) => !search || `${client.name} ${client.contact} ${client.website}`.toLowerCase().includes(search),
  )
  grid.innerHTML = clients.length
    ? clients
        .map(
          (client) => `
      <button class="client-card glass" type="button" data-client="${escapeHtml(client.key)}">
        <div class="client-card-head">
          <div><b>${escapeHtml(client.name)}</b><span>${escapeHtml(client.website || client.contact || '—')}</span></div>
        </div>
        <div class="client-card-stats">
          <div><small>Signé</small><strong>${formatMoney(client.wonValue)}</strong></div>
          <div><small>Ventes</small><strong>${client.won.length}</strong></div>
          <div><small>En cours</small><strong>${client.openValue ? formatMoney(client.openValue) : '—'}</strong></div>
        </div>
        <span class="client-card-foot">Dernière signature ${formatDate(client.lastWonAt)}</span>
      </button>`,
        )
        .join('')
    : `<div style="grid-column:1/-1">${emptyBlock(
        'ri-handshake-line',
        listClients().length ? 'Aucun résultat' : 'Aucun client pour l’instant',
        listClients().length ? 'Modifie ta recherche.' : 'Un lead passé en « Gagné » devient un client.',
        false,
      )}</div>`

  grid.querySelectorAll<HTMLButtonElement>('[data-client]').forEach((card) =>
    card.addEventListener('click', () => void openClient(card.dataset.client as string)),
  )
}

/* ---------------------------------------------------------------- fiche */

let openKey: string | null = null

export async function openClient(key: string): Promise<void> {
  openKey = key
  await renderClient(key, true)
}

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`

function dealLabel(lead: Lead): string {
  const offer = lead.offer ? OFFERS[lead.offer].label : 'Vente'
  return lead.nextStep && lead.stage !== 'won' ? `${offer} · ${lead.nextStep}` : offer
}

async function renderClient(key: string, first: boolean): Promise<void> {
  const client = listClients().find((item) => item.key === key)
  if (!client) {
    if (!first) closeModal()
    return
  }
  const docs = await listDocuments(key)
  // La fiche a pu être fermée ou remplacée pendant la lecture.
  if (!first && !document.querySelector(`#modalPanel [data-client="${CSS.escape(key)}"]`)) return

  const panel = openModal(`
    <div class="client-sheet" data-client="${escapeHtml(key)}">
      <div class="panel-head">
        <div class="detail-hero">
          <div>
            <h2>${escapeHtml(client.name)}</h2>
            <p>${
              client.website
                ? `<a href="https://${escapeHtml(client.website)}" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:none">${escapeHtml(client.website)}</a>`
                : 'Client'
            }${client.contact ? ` · ${escapeHtml(client.contact)}` : ''}</p>
          </div>
        </div>
        <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>

      <div class="client-kpis">
        <div><small>Chiffre signé</small><strong>${formatMoney(client.wonValue)}</strong></div>
        <div><small>Ventes gagnées</small><strong>${client.won.length}</strong></div>
        <div><small>En cours</small><strong>${formatMoney(client.openValue)}</strong></div>
      </div>

      <div class="client-section-head">
        <p class="section-title">Ventes</p>
        <button class="btn" type="button" id="newSale"><i class="ri-add-line"></i>Nouvelle vente</button>
      </div>
      <div class="deal-list">
        ${client.leads
          .map((lead) => {
            const meta = stageMeta(lead.stage)
            return `
          <button class="deal-row" type="button" data-deal="${lead.id}">
            <span class="chip" style="background:color-mix(in srgb, ${meta.color} 14%, var(--surface));color:${meta.color}">${meta.label}</span>
            <span class="deal-name"><b>${escapeHtml(dealLabel(lead))}</b><small>${escapeHtml(lead.contact || '—')} · ${formatDate(lead.updatedAt)}</small></span>
            <strong>${formatMoney(lead.value)}</strong>
          </button>`
          })
          .join('')}
      </div>

      <div class="client-section-head">
        <p class="section-title">Documents</p>
        <div class="doc-upload-opts">
          <select class="field" id="docCategory">
            ${(Object.keys(DOC_CATEGORIES) as DocCategory[])
              .map((category) => `<option value="${category}">${DOC_CATEGORIES[category].label}</option>`)
              .join('')}
          </select>
          <select class="field" id="docDeal">
            <option value="">Tout le client</option>
            ${client.won.map((lead) => `<option value="${lead.id}">${escapeHtml(dealLabel(lead))} · ${formatMoney(lead.value)}</option>`).join('')}
          </select>
        </div>
      </div>
      ${
        docs === null
          ? `<p class="studio-warning"><i class="ri-error-warning-line"></i>Exécute supabase/009-logos-clients.sql dans Supabase pour activer les documents.</p>`
          : `
      <label class="audio-drop" id="docDrop">
        <input type="file" id="docInput" multiple hidden>
        <i class="ri-upload-cloud-2-line"></i>
        <span><b>Dépose les contrats, devis, factures…</b><small>PDF, Word, images, 50 Mo maximum par fichier</small></span>
      </label>
      <div class="doc-rows">
        ${
          docs.length
            ? docs
                .map((doc) => {
                  const category = DOC_CATEGORIES[doc.category] ?? DOC_CATEGORIES.other
                  const deal = client.leads.find((lead) => lead.id === doc.leadId)
                  return `
            <div class="doc-row" data-doc="${doc.id}">
              <i class="${category.icon}"></i>
              <span class="deal-name"><b>${escapeHtml(doc.name)}</b><small>${category.label}${deal ? ` · ${escapeHtml(dealLabel(deal))}` : ''} · ${formatSize(doc.size)} · ${formatDate(doc.createdAt)}</small></span>
              <button class="icon-btn" type="button" data-doc-act="open" title="Ouvrir"><i class="ri-eye-line"></i></button>
              <button class="icon-btn" type="button" data-doc-act="download" title="Télécharger"><i class="ri-download-2-line"></i></button>
              <button class="icon-btn" type="button" data-doc-act="delete" title="Supprimer"><i class="ri-delete-bin-line"></i></button>
            </div>`
                })
                .join('')
            : emptyBlock('ri-folder-open-line', 'Aucun document', 'Les contrats et factures de ce client apparaîtront ici.')
        }
      </div>`
      }
    </div>`)

  panel.querySelector('#newSale')?.addEventListener('click', () => {
    const reference = client.won[0]
    // Une nouvelle vente reprend les coordonnées du client et repart en début de pipeline.
    openLeadForm(undefined, {
      company: client.name,
      contact: reference.contact,
      role: reference.role,
      email: reference.email,
      phone: reference.phone,
      website: client.website,
      source: 'Client existant',
      stage: 'qualified',
    })
  })

  panel.querySelectorAll<HTMLButtonElement>('[data-deal]').forEach((row) =>
    row.addEventListener('click', () => {
      closeModal()
      openLeadDrawer(row.dataset.deal as string)
    }),
  )

  if (!docs) return

  const send = async (files: File[]) => {
    if (!files.length) return
    const category = $<HTMLSelectElement>('#docCategory', panel).value as DocCategory
    const leadId = $<HTMLSelectElement>('#docDeal', panel).value || null
    const drop = panel.querySelector('#docDrop')
    drop?.classList.add('busy')
    let sent = 0
    for (const file of files) {
      try {
        await uploadDocument(key, file, category, leadId)
        sent++
      } catch (error) {
        toast((error as Error).message, 'error')
      }
    }
    if (sent) toast(sent > 1 ? `${sent} documents ajoutés.` : 'Document ajouté.')
    await renderClient(key, false)
  }

  const input = $<HTMLInputElement>('#docInput', panel)
  input.addEventListener('change', () => void send([...(input.files ?? [])]))
  const drop = $('#docDrop', panel)
  drop.addEventListener('dragover', (event) => {
    event.preventDefault()
    drop.classList.add('over')
  })
  drop.addEventListener('dragleave', () => drop.classList.remove('over'))
  drop.addEventListener('drop', (event) => {
    event.preventDefault()
    drop.classList.remove('over')
    void send([...(event.dataTransfer?.files ?? [])])
  })

  panel.querySelectorAll<HTMLElement>('[data-doc]').forEach((row) => {
    const doc = docs.find((item) => item.id === row.dataset.doc)
    if (!doc) return
    row.querySelectorAll<HTMLButtonElement>('[data-doc-act]').forEach((button) =>
      button.addEventListener('click', async () => {
        const action = button.dataset.docAct
        if (action === 'open') return void openDocument(doc, false)
        if (action === 'download') return void openDocument(doc, true)
        if (!confirm(`Supprimer définitivement « ${doc.name} » ?`)) return
        try {
          await removeDocument(doc)
          toast('Document supprimé.')
          await renderClient(key, false)
        } catch (error) {
          toast((error as Error).message, 'error')
        }
      }),
    )
  })
}

