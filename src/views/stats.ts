import { isAdmin, matchesOwnerFilter, memberName, state, subscribe } from '../store.js'
import type { Lead, Offer, Stage } from '../types.js'
import {
  $,
  OFFERS,
  STAGES,
  emptyBlock,
  escapeHtml,
  formatCompactMoney,
  formatMoney,
  viewIsActive,
} from '../ui.js'

/**
 * Analyses du portefeuille.
 *
 * Les formes suivent le travail demandé au lecteur : une rampe monochrome pour
 * les comparaisons de magnitude (entonnoir, sources, commerciaux), deux teintes
 * catégorielles validées pour l'unique comparaison d'identité (logiciel contre
 * audit), et des chiffres seuls là où un graphique n'apporterait rien.
 */

const OUVERTES = STAGES.filter((etape) => !etape.closed).map((etape) => etape.id)
const estOuvert = (lead: Lead) => OUVERTES.includes(lead.stage)
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function initStats(): void {
  subscribe(render)
}

/** Leads visibles : le filtre par compte du pipeline s'applique aussi ici. */
const corpus = (): Lead[] => state.leads.filter(matchesOwnerFilter)

/* ------------------------------------------------------------- primitives */

const echapper = (valeur: string) => escapeHtml(valeur)

/** Date de passage en « gagné », lue dans l'historique plutôt que devinée. */
function dateSignature(lead: Lead): string | null {
  if (lead.stage !== 'won') return null
  const passage = lead.activities.find((activite) => activite.text.includes('→ won'))
  return passage?.createdAt ?? lead.updatedAt ?? null
}

interface Barre {
  etiquette: string
  valeur: number
  affichage: string
  detail?: string
}

/**
 * Barres horizontales, rampe monochrome : la teinte porte la magnitude, pas
 * l'identité. Chaque barre est directement étiquetée, donc lisible sans couleur.
 */
function barres(items: Barre[], options: { vide: string }): string {
  if (!items.length || items.every((item) => item.valeur === 0)) {
    return `<p class="chart-empty">${echapper(options.vide)}</p>`
  }
  const max = Math.max(...items.map((item) => item.valeur), 1)
  return `<div class="chart-bars">${items
    .map((item) => {
      const part = Math.max((item.valeur / max) * 100, item.valeur > 0 ? 1.5 : 0)
      const intensite = 30 + Math.round((item.valeur / max) * 55)
      return `
        <div class="chart-bar" data-tip="${echapper(`${item.etiquette} — ${item.affichage}${item.detail ? ` · ${item.detail}` : ''}`)}">
          <span class="chart-bar-label">${echapper(item.etiquette)}</span>
          <span class="chart-bar-track">
            <span class="chart-bar-fill" style="width:${part}%;background:color-mix(in srgb, var(--chart-ramp) ${intensite}%, var(--chart-ramp-mix))"></span>
          </span>
          <span class="chart-bar-value">${echapper(item.affichage)}</span>
        </div>`
    })
    .join('')}</div>`
}

/** Colonnes dans le temps : une seule série, donc pas de légende. */
function colonnes(points: { etiquette: string; valeur: number; affichage: string }[]): string {
  const max = Math.max(...points.map((point) => point.valeur), 1)
  // Un seul repère chiffré, sur le mois le plus haut : une valeur sur chaque
  // colonne serait illisible, et l'infobulle porte le détail.
  const indexMax = points.findIndex((point) => point.valeur === max)
  return `<div class="chart-columns">${points
    .map((point, index) => {
      const hauteur = point.valeur > 0 ? Math.max((point.valeur / max) * 100, 3) : 0
      return `
        <div class="chart-column" data-tip="${echapper(`${point.etiquette} — ${point.affichage}`)}">
          <span class="chart-column-track">
            ${index === indexMax && point.valeur > 0 ? `<span class="chart-column-peak">${echapper(point.affichage)}</span>` : ''}
            <span class="chart-column-fill" style="height:${hauteur}%"></span>
          </span>
          <span class="chart-column-label">${echapper(point.etiquette)}</span>
        </div>`
    })
    .join('')}</div>`
}

/* ------------------------------------------------------------------ rendu */

function render(): void {
  if (!viewIsActive('stats')) return
  const leads = corpus()

  if (!leads.length) {
    $('#statsBody').innerHTML = emptyBlock(
      'ri-bar-chart-2-line',
      'Pas encore de données',
      'Les analyses apparaîtront dès que des leads seront enregistrés.',
      false,
    )
    $('#statsKpis').innerHTML = ''
    return
  }

  renderKpis(leads)
  $('#statsBody').innerHTML = [
    entonnoir(leads),
    comparaisonOffres(leads),
    signaturesParMois(leads),
    sources(leads),
    isAdmin() && state.members.length > 1 ? parCommercial(leads) : '',
  ].join('')
  brancherInfobulles()
}

function renderKpis(leads: Lead[]): void {
  const gagnes = leads.filter((lead) => lead.stage === 'won')
  const perdus = leads.filter((lead) => lead.stage === 'lost')
  const ouverts = leads.filter(estOuvert)
  const clos = gagnes.length + perdus.length
  const tauxConversion = clos ? Math.round((gagnes.length / clos) * 100) : 0
  const panierMoyen = gagnes.length ? gagnes.reduce((somme, lead) => somme + lead.value, 0) / gagnes.length : 0
  // La probabilité porte sur la signature du deal, pas sur une fraction du
  // montant : additionner des montants rabotés ne décrit rien de réel.
  const pipelineOuvert = ouverts.reduce((somme, lead) => somme + lead.value, 0)

  const delais = gagnes
    .map((lead) => {
      const fin = dateSignature(lead)
      if (!fin || !lead.createdAt) return null
      return (new Date(fin).getTime() - new Date(lead.createdAt).getTime()) / 86_400_000
    })
    .filter((jours): jours is number => jours !== null && jours >= 0)
  const cycleMoyen = delais.length ? Math.round(delais.reduce((s, v) => s + v, 0) / delais.length) : null

  $('#statsKpis').innerHTML = `
    <article class="metric glass"><small>Taux de conversion</small><strong>${tauxConversion} %</strong>
      <span class="metric-trend">${gagnes.length} gagné(s) sur ${clos} clôturé(s)</span></article>
    <article class="metric glass"><small>Panier moyen signé</small><strong>${formatCompactMoney(panierMoyen)}</strong>
      <span class="metric-trend">${gagnes.length} affaire(s) signée(s)</span></article>
    <article class="metric glass"><small>Pipeline ouvert</small><strong>${formatCompactMoney(pipelineOuvert)}</strong>
      <span class="metric-trend">${ouverts.length} opportunité(s) en cours</span></article>
    <article class="metric glass"><small>Cycle de vente moyen</small><strong>${cycleMoyen === null ? '—' : `${cycleMoyen} j`}</strong>
      <span class="metric-trend">${cycleMoyen === null ? 'aucune signature datée' : 'de la création à la signature'}</span></article>`
}

/** Entonnoir : effectif par étape et déperdition d'une étape à la suivante. */
function entonnoir(leads: Lead[]): string {
  const parEtape = (etape: Stage) => leads.filter((lead) => lead.stage === etape)
  const lignes = STAGES.map((etape) => {
    const groupe = parEtape(etape.id)
    return {
      etiquette: etape.label,
      valeur: groupe.length,
      affichage: `${groupe.length}`,
      detail: formatMoney(groupe.reduce((somme, lead) => somme + lead.value, 0)),
    }
  })

  // Une affaire perdue n'a pas « franchi » les étapes suivantes : elle est exclue
  // du calcul de passage, qui mesure la progression des affaires encore vivantes.
  const rang = (etape: Stage) => STAGES.findIndex((item) => item.id === etape)
  const atteint = (index: number) =>
    leads.filter((lead) => lead.stage !== 'lost' && rang(lead.stage) >= index).length

  const etapesOuvertes = STAGES.filter((etape) => !etape.closed)
  const passages = etapesOuvertes.map((etape, index) => {
    const depuis = atteint(rang(etape.id))
    const suivante = etapesOuvertes[index + 1]
    const vers = suivante ? atteint(rang(suivante.id)) : null
    return { etape, depuis, vers, suivante }
  })

  return `
    <section class="card glass chart-card">
      <div class="card-head"><div>
        <h2>Entonnoir du pipeline</h2>
        <p>Nombre d'affaires par étape, et part des affaires encore vivantes qui franchissent l'étape suivante.</p>
      </div></div>
      ${barres(
        lignes.map((ligne) => ({ ...ligne, affichage: `${ligne.affichage} · ${ligne.detail}` })),
        { vide: 'Aucune affaire.' },
      )}
      <div class="funnel-steps">
        ${passages
          .filter((passage) => passage.suivante && passage.depuis > 0)
          .map(
            (passage) => `
              <div class="funnel-step">
                <small>${echapper(passage.etape.label)} → ${echapper(passage.suivante!.label)}</small>
                <b>${Math.round(((passage.vers ?? 0) / passage.depuis) * 100)} %</b>
              </div>`,
          )
          .join('')}
      </div>
    </section>`
}

/** Seule comparaison d'identité de la page : deux teintes, légende et tableau. */
function comparaisonOffres(leads: Lead[]): string {
  const types: Offer[] = ['logiciel', 'audit', '']
  const stats = types.map((type) => {
    const groupe = leads.filter((lead) => (lead.offer ?? '') === type)
    const gagnes = groupe.filter((lead) => lead.stage === 'won')
    const perdus = groupe.filter((lead) => lead.stage === 'lost')
    const clos = gagnes.length + perdus.length
    return {
      type,
      libelle: OFFERS[type].label,
      total: groupe.length,
      signe: gagnes.reduce((somme, lead) => somme + lead.value, 0),
      ouvert: groupe.filter(estOuvert).reduce((somme, lead) => somme + lead.value, 0),
      taux: clos ? Math.round((gagnes.length / clos) * 100) : null,
      panier: gagnes.length ? gagnes.reduce((somme, lead) => somme + lead.value, 0) / gagnes.length : 0,
    }
  }).filter((ligne) => ligne.total > 0)

  if (!stats.length) return ''

  const maxSigne = Math.max(...stats.map((ligne) => ligne.signe), 1)
  const couleur = (type: Offer) =>
    type === 'logiciel' ? 'var(--chart-offer-1)' : type === 'audit' ? 'var(--chart-offer-2)' : 'var(--muted)'

  return `
    <section class="card glass chart-card">
      <div class="card-head"><div>
        <h2>Logiciel ou audit : ce qui se vend le mieux</h2>
        <p>Chiffre signé, volume et taux de transformation par type d'offre.</p>
      </div></div>
      <div class="chart-legend">
        ${stats
          .map(
            (ligne) => `<span class="legend-item"><span class="legend-swatch" style="background:${couleur(ligne.type)}"></span>${echapper(ligne.libelle)}</span>`,
          )
          .join('')}
      </div>
      <div class="chart-bars">
        ${stats
          .map((ligne) => {
            const part = ligne.signe > 0 ? Math.max((ligne.signe / maxSigne) * 100, 1.5) : 0
            return `
              <div class="chart-bar" data-tip="${echapper(`${ligne.libelle} — ${formatMoney(ligne.signe)} signés sur ${ligne.total} affaire(s)`)}">
                <span class="chart-bar-label">${echapper(ligne.libelle)}</span>
                <span class="chart-bar-track"><span class="chart-bar-fill" style="width:${part}%;background:${couleur(ligne.type)}"></span></span>
                <span class="chart-bar-value">${echapper(formatCompactMoney(ligne.signe))}</span>
              </div>`
          })
          .join('')}
      </div>
      <div class="table-wrap">
        <table class="table compact">
          <thead><tr><th>Offre</th><th>Affaires</th><th>Signé</th><th>En cours</th><th>Transformation</th><th>Panier moyen</th></tr></thead>
          <tbody>
            ${stats
              .map(
                (ligne) => `
                <tr>
                  <td><span class="legend-swatch" style="background:${couleur(ligne.type)}"></span> ${echapper(ligne.libelle)}</td>
                  <td class="num">${ligne.total}</td>
                  <td class="num">${escapeHtml(formatMoney(ligne.signe))}</td>
                  <td class="num">${escapeHtml(formatMoney(ligne.ouvert))}</td>
                  <td class="num">${ligne.taux === null ? '—' : `${ligne.taux} %`}</td>
                  <td class="num">${escapeHtml(formatMoney(ligne.panier))}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`
}

/** Chiffre signé mois par mois, sur douze mois glissants. */
function signaturesParMois(leads: Lead[]): string {
  const aujourdhui = new Date()
  const points = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - (11 - index), 1)
    const montant = leads.reduce((somme, lead) => {
      const signature = dateSignature(lead)
      if (!signature) return somme
      const quand = new Date(signature)
      return quand.getFullYear() === date.getFullYear() && quand.getMonth() === date.getMonth()
        ? somme + lead.value
        : somme
    }, 0)
    return {
      etiquette: MOIS[date.getMonth()],
      valeur: montant,
      affichage: formatMoney(montant),
    }
  })

  const total = points.reduce((somme, point) => somme + point.valeur, 0)
  if (total === 0) return ''

  return `
    <section class="card glass chart-card">
      <div class="card-head"><div>
        <h2>Chiffre signé par mois</h2>
        <p>Douze mois glissants, d'après la date de passage en « gagné ».</p>
      </div><b class="chart-total">${escapeHtml(formatMoney(total))}</b></div>
      ${colonnes(points)}
    </section>`
}

/** D'où viennent les affaires, et lesquelles rapportent. */
function sources(leads: Lead[]): string {
  const parSource = new Map<string, { total: number; signe: number }>()
  leads.forEach((lead) => {
    const cle = lead.source.trim() || 'Non renseignée'
    const entree = parSource.get(cle) ?? { total: 0, signe: 0 }
    entree.total += 1
    if (lead.stage === 'won') entree.signe += lead.value
    parSource.set(cle, entree)
  })

  const lignes = [...parSource.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([nom, valeurs]) => ({
      etiquette: nom,
      valeur: valeurs.total,
      affichage: `${valeurs.total} affaire(s)`,
      detail: valeurs.signe ? `${formatMoney(valeurs.signe)} signés` : undefined,
    }))

  if (lignes.length < 2) return ''

  return `
    <section class="card glass chart-card">
      <div class="card-head"><div>
        <h2>Origine des affaires</h2>
        <p>Nombre d'opportunités par source, et chiffre signé associé.</p>
      </div></div>
      ${barres(lignes, { vide: 'Aucune source renseignée.' })}
    </section>`
}

/** Vue d'équipe : réservée aux administrateurs. */
function parCommercial(leads: Lead[]): string {
  const lignes = state.members
    .map((membre) => {
      const siens = leads.filter((lead) => lead.owner_id === membre.id)
      const signe = siens.filter((lead) => lead.stage === 'won').reduce((somme, lead) => somme + lead.value, 0)
      const ouvert = siens.filter(estOuvert).reduce((somme, lead) => somme + lead.value, 0)
      return {
        etiquette: memberName(membre.id),
        valeur: signe,
        affichage: formatCompactMoney(signe),
        detail: `${siens.length} affaire(s) · ${formatMoney(ouvert)} en cours`,
      }
    })
    .filter((ligne) => ligne.detail !== '0 affaire(s) · 0 € en cours')
    .sort((a, b) => b.valeur - a.valeur)

  if (lignes.length < 2) return ''

  return `
    <section class="card glass chart-card">
      <div class="card-head"><div>
        <h2>Chiffre signé par commercial</h2>
        <p>Classement sur le périmètre actuellement filtré.</p>
      </div></div>
      ${barres(lignes, { vide: 'Aucune affaire attribuée.' })}
    </section>`
}

/* ------------------------------------------------------------ infobulles */

function brancherInfobulles(): void {
  const bulle = $('#chartTip')
  $('#statsBody')
    .querySelectorAll<HTMLElement>('[data-tip]')
    .forEach((marque) => {
      marque.addEventListener('mouseenter', () => {
        bulle.textContent = marque.dataset.tip ?? ''
        bulle.classList.add('show')
      })
      marque.addEventListener('mousemove', (evenement) => {
        bulle.style.left = `${evenement.clientX}px`
        bulle.style.top = `${evenement.clientY - 14}px`
      })
      marque.addEventListener('mouseleave', () => bulle.classList.remove('show'))
    })
}
