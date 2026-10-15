import { api } from '../api.js'
import { isModalOpen, openModal } from '../modal.js'
import { findLead, state, upsertLead } from '../store.js'
import type { Lead } from '../types.js'
import { $, escapeHtml, toast } from '../ui.js'
import { isAudioFile, transcribeFiles } from './audio.js'
import { prepareLogo } from './brand.js'
import type { Brand, GenerateStep, ProposalRecord, SaleKind, StudioInput } from './model.js'
import { SALE_KINDS } from './model.js'
import {
  DOC_KINDS,
  type DocKind,
  type StepState,
  downloadDoc,
  generateContent,
  listProposals,
  openDoc,
  saveProposal,
} from './service.js'

/**
 * Studio « Présentation + propal » : le commercial donne le logo, ce qu'il vend
 * et les enregistrements des rendez-vous ; le reste est généré.
 *
 * Une génération continue si la fenêtre est fermée : elle est suivie par lead,
 * et le résultat s'ajoute à la fiche du lead une fois prêt.
 */

export const PROPOSALS_CHANGED = 'proposals:changed'

interface Draft {
  brand: Brand
  website: string
  sale: SaleKind
  price: number
  offerDescription: string
  includeTechDoc: boolean
  files: File[]
  notes: string
  specialRequest: string
  billing: StudioInput['billing']
}

type Phase = 'transcribe' | GenerateStep

interface Job {
  leadId: string
  includeTechDoc: boolean
  hasAudio: boolean
  steps: Record<Phase, StepState>
  audio: string
  result: ProposalRecord | null
  warning: string
  error: string
}

const jobs = new Map<string, Job>()
const drafts = new Map<string, Draft>()

/* ---------------------------------------------------------------- entrée */

export async function openStudio(leadId: string): Promise<void> {
  const lead = findLead(leadId)
  if (!lead) return
  const job = jobs.get(leadId)
  if (job && !job.result && !job.error) {
    renderProgress(lead, job)
    return
  }
  const draft = drafts.get(leadId) ?? (await initialDraft(lead))
  drafts.set(leadId, draft)
  renderForm(lead, draft)
}

async function initialDraft(lead: Lead): Promise<Draft> {
  // Une génération précédente fournit le logo, les couleurs et la facturation.
  const previous = (await listProposals(lead.id))[0]
  const sale: SaleKind = lead.offer === 'logiciel' ? 'logiciel' : 'audit'
  return {
    brand: previous?.brand ?? { logo: '', primary: '#1976d2', secondary: '' },
    website: previous?.input.website ?? '',
    sale: previous?.input.sale ?? sale,
    price: lead.value || previous?.input.price || 0,
    offerDescription: previous?.input.offerDescription ?? '',
    includeTechDoc: previous?.input.includeTechDoc ?? sale !== 'audit',
    files: [],
    notes: '',
    specialRequest: '',
    billing: previous?.input.billing ?? {
      legalName: lead.company,
      siret: '',
      address: '',
      postalCity: '',
      signatory: lead.contact,
      signatoryRole: lead.role,
      paymentTerms: '',
    },
  }
}

/* ------------------------------------------------------------ formulaire */

const field = (id: string, label: string, value: string, placeholder = '', full = false) => `
  <div class="field-group${full ? ' full' : ''}"><label for="${id}">${label}</label>
    <input class="field" id="${id}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></div>`

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`

function renderForm(lead: Lead, draft: Draft): void {
  const panel = openModal(`
    <div class="studio" data-studio="${lead.id}">
      <div class="panel-head">
        <div>
          <h2>Présentation + propal</h2>
          <p>${escapeHtml(lead.company || lead.contact)} · générées sur mesure à partir de tes rendez-vous.</p>
        </div>
        <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>

      <form id="studioForm" class="studio-form">
        <section class="studio-block">
          <p class="studio-label"><span>1</span>Identité du client</p>
          <div class="brand-row">
            <label class="logo-drop${draft.brand.logo ? ' has-logo' : ''}" id="logoDrop" title="Changer le logo">
              <input type="file" id="logoInput" accept="image/*" hidden>
              ${
                draft.brand.logo
                  ? `<img src="${draft.brand.logo}" alt="Logo">`
                  : '<i class="ri-image-add-line"></i><b>Logo du client</b><small>Glisse ou clique</small>'
              }
            </label>
            <div class="brand-side">
              <div class="swatches">
                <label class="color-pick"><input type="color" id="colorPrimary" value="${draft.brand.primary}"><span><b>Couleur principale</b><small>${draft.brand.primary}</small></span></label>
                <label class="color-pick"><input type="color" id="colorSecondary" value="${draft.brand.secondary || '#203040'}"><span><b>Secondaire</b><small>${draft.brand.secondary || 'auto'}</small></span></label>
              </div>
              <p class="studio-hint"><i class="ri-magic-line"></i>Détectées depuis le logo. Avec le site web, l'IA reprend aussi ses polices et toute sa charte.</p>
              <input class="field" id="studioWebsite" value="${escapeHtml(draft.website)}" placeholder="Site web du client : acme.fr (recommandé, sa DA est reprise)">
            </div>
          </div>
        </section>

        <section class="studio-block">
          <p class="studio-label"><span>2</span>Ce que tu vends</p>
          <div class="segmented" role="radiogroup">
            ${(Object.keys(SALE_KINDS) as SaleKind[])
              .map(
                (kind) =>
                  `<label class="${draft.sale === kind ? 'active' : ''}"><input type="radio" name="sale" value="${kind}"${draft.sale === kind ? ' checked' : ''}>${SALE_KINDS[kind]}</label>`,
              )
              .join('')}
          </div>
          <div class="studio-row">
            <div class="field-group"><label for="studioPrice">Prix total TTC (€)</label>
              <input class="field" id="studioPrice" type="number" min="0" step="50" value="${draft.price || ''}" placeholder="Vide = proposé par l'IA"></div>
            <label class="toggle">
              <input type="checkbox" id="studioTechDoc"${draft.includeTechDoc ? ' checked' : ''}>
              <span><b>Doc technique des outils</b><small>Si des outils sont proposés</small></span>
            </label>
          </div>
          <textarea class="field" id="studioOffer" rows="2" placeholder="Décris l'offre si besoin : périmètre, outils, options, ce qui a été montré en démo…">${escapeHtml(draft.offerDescription)}</textarea>
        </section>

        <section class="studio-block">
          <p class="studio-label"><span>3</span>Les rendez-vous</p>
          <label class="audio-drop" id="audioDrop">
            <input type="file" id="audioInput" accept="audio/*,video/*" multiple hidden>
            <i class="ri-mic-2-line"></i>
            <span><b>Dépose les enregistrements du R1, de la démo…</b><small>Audio ou vidéo, plusieurs fichiers possibles</small></span>
          </label>
          <ul class="file-list" id="fileList">
            ${draft.files
              .map(
                (file, index) =>
                  `<li><i class="ri-file-music-line"></i><span>${escapeHtml(file.name)}</span><small>${formatSize(file.size)}</small><button type="button" class="icon-btn" data-remove-file="${index}" aria-label="Retirer"><i class="ri-close-line"></i></button></li>`,
              )
              .join('')}
          </ul>
          <textarea class="field" id="studioNotes" rows="2" placeholder="Et / ou colle tes notes, un compte-rendu, une transcription…">${escapeHtml(draft.notes)}</textarea>
        </section>

        <section class="studio-block">
          <p class="studio-label"><span>4</span>Demande particulière <em>facultatif</em></p>
          <textarea class="field" id="studioSpecial" rows="2" placeholder="Ex. : le DG est sceptique sur l'IA, insister sur le ROI, 8 slides maximum, mettre en avant la démo…">${escapeHtml(draft.specialRequest)}</textarea>
        </section>

        <details class="studio-block billing">
          <summary class="studio-label"><span>5</span>Infos de facturation <em>pour la propal</em><i class="ri-arrow-down-s-line"></i></summary>
          <div class="form-grid">
            ${field('billLegal', 'Raison sociale', draft.billing.legalName, 'ACME SAS')}
            ${field('billSiret', 'SIRET', draft.billing.siret, '123 456 789 00012')}
            ${field('billAddress', 'Adresse', draft.billing.address, '12 rue des Forges')}
            ${field('billCity', 'Code postal et ville', draft.billing.postalCity, '76000 Rouen')}
            ${field('billSignatory', 'Signataire', draft.billing.signatory, 'Prénom Nom')}
            ${field('billRole', 'Fonction du signataire', draft.billing.signatoryRole, 'Directeur général')}
            ${field('billTerms', 'Conditions de paiement', draft.billing.paymentTerms, "Vide = proposées par l'IA (ex. 50 % à la commande ; 50 % à la livraison)", true)}
          </div>
        </details>

        <div class="form-actions">
          <span class="spacer studio-hint"><i class="ri-time-line"></i>3 à 5 min, plus la transcription</span>
          <button class="btn" type="button" data-close-modal>Annuler</button>
          <button class="btn primary" type="submit"><i class="ri-sparkling-2-line"></i>Générer</button>
        </div>
      </form>
    </div>`)

  bindForm(panel, lead, draft)
}

function readForm(panel: HTMLElement, draft: Draft): void {
  const value = (id: string) => $<HTMLInputElement>(`#${id}`, panel).value.trim()
  draft.website = value('studioWebsite')
  draft.sale = (panel.querySelector<HTMLInputElement>('input[name="sale"]:checked')?.value as SaleKind) ?? 'audit'
  draft.price = Number(value('studioPrice')) || 0
  draft.includeTechDoc = $<HTMLInputElement>('#studioTechDoc', panel).checked
  draft.offerDescription = value('studioOffer')
  draft.notes = value('studioNotes')
  draft.specialRequest = value('studioSpecial')
  draft.billing = {
    legalName: value('billLegal'),
    siret: value('billSiret'),
    address: value('billAddress'),
    postalCity: value('billCity'),
    signatory: value('billSignatory'),
    signatoryRole: value('billRole'),
    paymentTerms: value('billTerms'),
  }
}

function bindForm(panel: HTMLElement, lead: Lead, draft: Draft): void {
  // Ajouter un fichier redessine le formulaire : on garde la position et le bloc ouvert.
  const rerender = () => {
    readForm(panel, draft)
    const scroll = panel.scrollTop
    const billingOpen = panel.querySelector<HTMLDetailsElement>('details.billing')?.open ?? false
    renderForm(lead, draft)
    const next = $('#modalPanel')
    const billing = next.querySelector<HTMLDetailsElement>('details.billing')
    if (billing) billing.open = billingOpen
    next.scrollTop = scroll
  }

  // Logo : clic ou glisser-déposer.
  const logoDrop = $('#logoDrop', panel)
  const takeLogo = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast('Le logo doit être une image.', 'error')
    try {
      logoDrop.classList.add('busy')
      const logo = await prepareLogo(file)
      draft.brand = { logo: logo.dataUrl, primary: logo.primary, secondary: logo.secondary }
      rerender()
    } catch (error) {
      logoDrop.classList.remove('busy')
      toast((error as Error).message, 'error')
    }
  }
  $<HTMLInputElement>('#logoInput', panel).addEventListener('change', (event) =>
    takeLogo((event.target as HTMLInputElement).files?.[0]),
  )
  dropZone(logoDrop, (files) => takeLogo(files[0]))

  panel.querySelectorAll<HTMLInputElement>('input[type="color"]').forEach((input) =>
    input.addEventListener('input', () => {
      if (input.id === 'colorPrimary') draft.brand.primary = input.value
      else draft.brand.secondary = input.value
      const small = input.parentElement?.querySelector('small')
      if (small) small.textContent = input.value
    }),
  )

  panel.querySelectorAll<HTMLInputElement>('input[name="sale"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      panel.querySelectorAll('.segmented label').forEach((label) => label.classList.toggle('active', label.contains(radio)))
      // La doc technique accompagne d'office un logiciel ; pour un audit, c'est au choix.
      if (radio.value !== 'audit') $<HTMLInputElement>('#studioTechDoc', panel).checked = true
    }),
  )

  // Enregistrements.
  const addFiles = (files: File[]) => {
    const audio = files.filter(isAudioFile)
    if (audio.length < files.length) toast('Seuls les fichiers audio ou vidéo sont acceptés.', 'error')
    if (!audio.length) return
    draft.files.push(...audio)
    rerender()
  }
  $<HTMLInputElement>('#audioInput', panel).addEventListener('change', (event) =>
    addFiles([...((event.target as HTMLInputElement).files ?? [])]),
  )
  dropZone($('#audioDrop', panel), addFiles)
  panel.querySelectorAll<HTMLButtonElement>('[data-remove-file]').forEach((button) =>
    button.addEventListener('click', () => {
      draft.files.splice(Number(button.dataset.removeFile), 1)
      rerender()
    }),
  )

  $<HTMLFormElement>('#studioForm', panel).addEventListener('submit', (event) => {
    event.preventDefault()
    readForm(panel, draft)
    if (!draft.files.length && !draft.notes && !lead.notes && !draft.offerDescription) {
      toast('Ajoute un enregistrement ou des notes : la présentation part du besoin réel du client.', 'error')
      return
    }
    void run(lead, draft)
  })
}

function dropZone(zone: HTMLElement, onFiles: (files: File[]) => void): void {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault()
    zone.classList.add('over')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('over'))
  zone.addEventListener('drop', (event) => {
    event.preventDefault()
    zone.classList.remove('over')
    onFiles([...(event.dataTransfer?.files ?? [])])
  })
}

/* ------------------------------------------------------------ génération */

function leadNotes(lead: Lead): string {
  const history = lead.activities
    .filter((activity) => activity.kind !== 'stage')
    .slice(0, 30)
    .map((activity) => `- ${activity.createdAt.slice(0, 10)} : ${activity.text}`)
  return [
    lead.notes && `Notes : ${lead.notes}`,
    lead.nextStep && `Prochaine action : ${lead.nextStep}`,
    lead.tags.length ? `Tags : ${lead.tags.join(', ')}` : '',
    history.length ? `Historique :\n${history.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function run(lead: Lead, draft: Draft): Promise<void> {
  const job: Job = {
    leadId: lead.id,
    includeTechDoc: draft.includeTechDoc,
    hasAudio: draft.files.length > 0,
    steps: { transcribe: 'pending', brief: 'pending', deck: 'pending', proposal: 'pending', techdoc: 'pending' },
    audio: '',
    result: null,
    warning: '',
    error: '',
  }
  jobs.set(lead.id, job)
  const refresh = () => {
    const current = findLead(lead.id)
    if (current && isShowing(lead.id)) renderProgress(current, job)
  }
  refresh()

  try {
    let transcript = ''
    if (draft.files.length) {
      job.steps.transcribe = 'running'
      refresh()
      transcript = await transcribeFiles(draft.files, `${lead.company}, ${lead.contact}, Nira`, (progress) => {
        job.audio = `${progress.file} · ${Math.round((progress.done / progress.total) * 100)} %`
        refresh()
      })
      job.steps.transcribe = 'done'
    }

    const input: StudioInput = {
      company: lead.company || lead.contact,
      contact: lead.contact,
      contactRole: lead.role,
      sale: draft.sale,
      offerDescription: draft.offerDescription,
      price: draft.price,
      includeTechDoc: draft.includeTechDoc,
      specialRequest: draft.specialRequest,
      website: draft.website,
      transcript: [transcript, draft.notes && `[Notes du commercial]\n${draft.notes}`].filter(Boolean).join('\n\n'),
      leadNotes: leadNotes(lead),
      billing: draft.billing,
      seller: { name: state.profile?.full_name || '', email: state.profile?.email || '' },
    }

    const content = await generateContent(input, draft.brand, (step, stepState) => {
      job.steps[step] = stepState
      refresh()
    })

    const unsaved: ProposalRecord = {
      id: '',
      leadId: lead.id,
      owner_id: state.profile?.id ?? null,
      input,
      brand: draft.brand,
      content,
      createdAt: new Date().toISOString(),
    }
    try {
      job.result = await saveProposal(lead.id, input, draft.brand, content)
      upsertLead(await api.addActivity(lead.id, { kind: 'note', text: 'Présentation + propal générées.' }))
    } catch (error) {
      job.result = unsaved
      job.warning = (error as Error).message
    }
    // Les fichiers et les notes ont servi : un prochain essai repart d'une saisie propre.
    draft.files = []
    window.dispatchEvent(new CustomEvent(PROPOSALS_CHANGED, { detail: lead.id }))
  } catch (error) {
    job.error = (error as Error).message
    if (job.steps.transcribe === 'running') job.steps.transcribe = 'error'
  }

  const current = findLead(lead.id)
  if (current && isShowing(lead.id)) {
    if (job.result) renderResult(current, job.result, job.warning)
    else renderProgress(current, job)
  } else if (job.result) {
    toast(`Présentation + propal prêtes pour ${lead.company || lead.contact}.`)
  } else {
    toast(`Génération échouée pour ${lead.company || lead.contact} : ${job.error}`, 'error')
  }
  if (job.result) jobs.delete(lead.id)
}

const isShowing = (leadId: string) =>
  isModalOpen() && Boolean(document.querySelector(`#modalPanel .studio[data-studio="${leadId}"]`))

/* ------------------------------------------------------------ progression */

const STEP_LABELS: Record<Phase, string> = {
  transcribe: 'Transcription des rendez-vous',
  brief: 'Analyse du besoin du client',
  deck: 'Présentation commerciale',
  proposal: 'Proposition commerciale',
  techdoc: 'Documentation technique',
}

const STEP_ICONS: Record<StepState, string> = {
  pending: 'ri-checkbox-blank-circle-line',
  running: 'ri-loader-4-line',
  done: 'ri-checkbox-circle-fill',
  error: 'ri-error-warning-fill',
}

function renderProgress(lead: Lead, job: Job): void {
  const phases = (Object.keys(STEP_LABELS) as Phase[]).filter(
    (phase) => (phase !== 'transcribe' || job.hasAudio) && (phase !== 'techdoc' || job.includeTechDoc),
  )
  const panel = openModal(`
    <div class="studio" data-studio="${lead.id}">
      <div class="panel-head">
        <div>
          <h2>${job.error ? 'La génération a échoué' : 'Génération en cours…'}</h2>
          <p>${escapeHtml(lead.company || lead.contact)} · ${job.error ? escapeHtml(job.error) : 'tu peux fermer cette fenêtre, le travail continue.'}</p>
        </div>
        <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>
      <ol class="studio-steps">
        ${phases
          .map(
            (phase) => `
          <li class="${job.steps[phase]}">
            <i class="${STEP_ICONS[job.steps[phase]]}"></i>
            <span>${STEP_LABELS[phase]}</span>
            ${phase === 'transcribe' && job.steps.transcribe === 'running' ? `<small>${escapeHtml(job.audio)}</small>` : ''}
          </li>`,
          )
          .join('')}
      </ol>
      ${
        job.error
          ? `<div class="form-actions"><button class="btn" type="button" data-close-modal>Fermer</button>
             <button class="btn primary" type="button" id="studioRetry"><i class="ri-refresh-line"></i>Revenir au formulaire</button></div>`
          : ''
      }
    </div>`)

  panel.querySelector('#studioRetry')?.addEventListener('click', () => {
    jobs.delete(lead.id)
    void openStudio(lead.id)
  })
}

/* ------------------------------------------------------------ résultat */

export function docActions(record: ProposalRecord, compact = false): string {
  const kinds: DocKind[] = record.content.techdoc ? ['deck', 'proposal', 'techdoc'] : ['deck', 'proposal']
  return kinds
    .map(
      (kind) => `
      <div class="doc-tile${compact ? ' compact' : ''}">
        <i class="${DOC_KINDS[kind].icon}"></i>
        <b>${DOC_KINDS[kind].label}</b>
        <div class="doc-actions">
          <button class="btn${compact ? '' : ' primary'}" type="button" data-doc-open="${kind}" data-record="${record.id}"><i class="ri-external-link-line"></i>Ouvrir</button>
          <button class="btn" type="button" data-doc-pdf="${kind}" data-record="${record.id}" title="Exporter en PDF"><i class="ri-file-pdf-2-line"></i>PDF</button>
          <button class="icon-btn" type="button" data-doc-download="${kind}" data-record="${record.id}" title="Télécharger le fichier HTML"><i class="ri-download-2-line"></i></button>
        </div>
      </div>`,
    )
    .join('')
}

export function bindDocActions(scope: HTMLElement, records: ProposalRecord[]): void {
  const find = (id: string | undefined) => records.find((record) => record.id === id)
  scope.querySelectorAll<HTMLButtonElement>('[data-doc-open]').forEach((button) =>
    button.addEventListener('click', () => {
      const record = find(button.dataset.record)
      if (record) openDoc(button.dataset.docOpen as DocKind, record)
    }),
  )
  scope.querySelectorAll<HTMLButtonElement>('[data-doc-pdf]').forEach((button) =>
    button.addEventListener('click', () => {
      const record = find(button.dataset.record)
      if (record) openDoc(button.dataset.docPdf as DocKind, record, true)
    }),
  )
  scope.querySelectorAll<HTMLButtonElement>('[data-doc-download]').forEach((button) =>
    button.addEventListener('click', () => {
      const record = find(button.dataset.record)
      if (record) downloadDoc(button.dataset.docDownload as DocKind, record)
    }),
  )
}

function renderResult(lead: Lead, record: ProposalRecord, warning: string): void {
  const missing = record.content.brief.missingInfo
  const panel = openModal(`
    <div class="studio" data-studio="${lead.id}">
      <div class="panel-head">
        <div>
          <h2>C'est prêt ✦</h2>
          <p>${escapeHtml(record.content.brief.projectTitle)} · ${escapeHtml(lead.company || lead.contact)}</p>
        </div>
        <button class="icon-btn" type="button" data-close-modal aria-label="Fermer"><i class="ri-close-line"></i></button>
      </div>
      ${warning ? `<p class="studio-warning"><i class="ri-error-warning-line"></i>${escapeHtml(warning)}</p>` : ''}
      <div class="doc-tiles">${docActions(record)}</div>
      ${
        missing.length
          ? `<div class="studio-check">
              <p class="studio-label"><i class="ri-shield-check-line"></i>À vérifier avant d'envoyer</p>
              <ul>${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </div>`
          : ''
      }
      <div class="form-actions">
        <button class="btn spacer" type="button" id="studioAgain"><i class="ri-refresh-line"></i>Régénérer avec d'autres consignes</button>
        <button class="btn primary" type="button" data-close-modal>Terminé</button>
      </div>
    </div>`)

  bindDocActions(panel, [record])
  panel.querySelector('#studioAgain')?.addEventListener('click', () => void openStudio(lead.id))
}
