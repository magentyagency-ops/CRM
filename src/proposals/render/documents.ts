import type { Brand, GeneratedContent, StudioInput, TechDoc } from '../model.js'
import { esc, fontsOf, longDate, money, niraMark, paletteCss, paletteOf } from '../theme.js'
import { NIRA, PRINT_ON_HASH, pricingOf } from './common.js'

/**
 * Proposition commerciale et documentation technique : des documents A4
 * autonomes, lisibles à l'écran comme une feuille et imprimables en PDF.
 */

const CSS = `
*{box-sizing:border-box}
html{background:var(--bg-2)}
body{margin:0;font:15px/1.65 var(--f-body);color:#25303d;-webkit-font-smoothing:antialiased}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:10px;padding:12px;background:color-mix(in srgb,var(--bg-2) 85%,transparent);backdrop-filter:blur(8px)}
.toolbar button{border:1px solid var(--line);background:#fff;color:var(--ink);padding:9px 16px;border-radius:999px;font:600 13px var(--f-body);cursor:pointer;box-shadow:0 6px 16px var(--shadow)}
.toolbar button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.sheet{width:min(860px,100% - 24px);margin:8px auto 48px;background:#fff;border-radius:6px;box-shadow:0 30px 80px var(--shadow);padding:64px 68px 72px}
h1,h2,h3{font-family:var(--f-head);color:var(--ink);margin:0;font-weight:var(--hw)}
.doc-head{display:flex;justify-content:space-between;align-items:center;padding-bottom:26px;margin-bottom:38px;border-bottom:1px solid var(--line)}
.doc-head img{max-height:46px;max-width:200px;object-fit:contain;display:block}
.doc-head .client{font:var(--hw) 20px var(--f-head);color:var(--ink)}
.doc-head .by{display:flex;align-items:center;gap:10px;font:500 11px var(--f-mono);color:var(--muted);letter-spacing:.08em;text-transform:uppercase}
.kicker{font:600 12px var(--f-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 12px}
.title{font-size:38px;line-height:1.1;letter-spacing:var(--tr);margin-bottom:12px}
.subtitle{font-size:17px;color:var(--muted);margin:0 0 34px;max-width:640px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:26px}
.party{background:var(--bg);border-radius:12px;padding:20px 22px;font-size:14px;line-height:1.75}
.party h3{font:700 12px var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.party b{color:var(--ink)}
.meta{width:100%;border-collapse:collapse;margin-bottom:40px;font-size:14px}
.meta td{padding:13px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);vertical-align:top}
.meta td:first-child{width:190px;font-weight:700;color:var(--ink)}
.meta .amount{font-weight:700;color:var(--accent)}
section{margin-top:40px}
h2{font-size:24px;letter-spacing:-.02em;color:var(--accent);margin-bottom:16px;display:flex;gap:12px;align-items:baseline;break-after:avoid}
h2 .n{font:600 13px var(--f-mono);color:var(--muted);letter-spacing:.06em}
h3{font-size:17px;letter-spacing:-.01em;margin-bottom:6px}
p{margin:0 0 12px}
.intro{font-size:16.5px;color:#34404e;border-left:3px solid var(--primary);padding:4px 0 4px 20px;margin:0 0 8px}
.highlights{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px}
.hl{background:var(--soft);border-radius:12px;padding:16px 18px;break-inside:avoid}
.hl strong{display:block;font:var(--hw) 28px/1.1 var(--f-head);color:var(--accent);letter-spacing:-.03em}
.hl span{font-size:13px;color:var(--muted)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
.box{background:var(--bg);border-radius:12px;padding:22px 22px 20px;break-inside:avoid;position:relative}
.box:before{content:'';position:absolute;top:0;left:22px;width:36px;height:4px;border-radius:0 0 4px 4px;background:var(--primary)}
.box:nth-child(even):before{background:var(--accent-2)}
.box p{margin:0;font-size:14px;color:#46515e}
.list{margin:8px 0 0;padding:0;list-style:none}
.list li{position:relative;padding:8px 0 8px 26px;border-bottom:1px solid var(--line);font-size:14.5px;break-inside:avoid}
.list li:last-child{border-bottom:0}
.list li:before{content:'';position:absolute;left:4px;top:17px;width:8px;height:8px;border-radius:50%;background:var(--primary)}
.list b{color:var(--ink)}
table.data{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px}
table.data th{background:var(--accent);color:#fff;text-align:left;padding:13px 16px;font-weight:600;font-size:13px}
table.data th:first-child{border-radius:8px 0 0 0}table.data th:last-child{border-radius:0 8px 0 0}
table.data td{padding:14px 16px;border-bottom:1px solid var(--line);vertical-align:top}
table.data tr{break-inside:avoid}
table.data td ul{margin:0;padding-left:16px}
table.data td li{margin:2px 0}
table.data .num{text-align:right;white-space:nowrap}
table.data .strong{font-weight:700;color:var(--ink)}
table.data small{display:block;color:var(--muted);font-size:13px;margin-top:3px}
.total td{background:var(--bg);font-weight:700;color:var(--ink);border-bottom:0}
.total .num{color:var(--accent);font-size:17px}
.terms{margin-top:18px;font-size:14px}
.terms b{color:var(--ink)}
.timeline{margin-top:14px;display:grid;gap:10px}
.tl{display:grid;grid-template-columns:150px 1fr;gap:18px;padding:16px 18px;background:var(--bg);border-radius:12px;break-inside:avoid}
.tl .when{font:600 12px var(--f-mono);color:var(--accent);letter-spacing:.06em;text-transform:uppercase}
.tl p{margin:0;font-size:14px;color:#46515e}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:16px;break-inside:avoid}
.sign .party{border:1px solid var(--line);background:#fcfdfe;min-height:210px;display:flex;flex-direction:column}
.sign .line{margin-top:auto;padding-top:10px;border-top:1px dashed #c6d0db;font-size:12px;color:var(--muted)}
.sign em{color:var(--muted)}
.layers{margin-top:16px;display:grid;gap:0}
.layer{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:stretch;break-inside:avoid}
.layer+.layer{margin-top:28px;position:relative}
.layer+.layer:before{content:'↓';position:absolute;left:66px;top:-25px;font-size:16px;color:var(--accent)}
.layer-name{background:var(--soft);color:var(--accent);border-radius:12px;padding:14px;display:flex;align-items:center;font:600 12px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;line-height:1.4}
.layer-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.comp{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}
.comp b{display:block;color:var(--ink);font-size:14px}
.comp span{display:block;font-size:12.5px;color:#56616d;line-height:1.45;margin-top:3px}
.comp code{display:inline-block;margin-top:8px;font:500 11px var(--f-mono);color:var(--accent);background:var(--soft);padding:3px 7px;border-radius:6px}
.tool{border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin-top:14px;break-inside:avoid}
.tool-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
.tool-head h3{font-size:19px;margin:0}
.chip{font:600 11px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--accent);background:var(--soft);padding:5px 10px;border-radius:999px;white-space:nowrap}
.kv{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.kv div{background:var(--bg);border-radius:10px;padding:10px 12px;font-size:13px}
.kv small{display:block;font:600 10.5px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}
.steps{counter-reset:s;margin-top:14px;display:grid;gap:10px}
.stepi{counter-increment:s;display:grid;grid-template-columns:34px 1fr;gap:14px;align-items:start;break-inside:avoid}
.stepi:before{content:counter(s);width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--soft);color:var(--accent);font:600 13px var(--f-mono)}
.stepi p{margin:4px 0 0;font-size:14px;color:#46515e}
.foot{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font:500 11px var(--f-mono);color:var(--muted);letter-spacing:.04em}
.light-brand table.data th,.light-brand .toolbar button.primary{background:var(--grad-a);border-color:var(--grad-a)}
.light-brand .hl,.light-brand .layer-name{box-shadow:inset 4px 0 0 var(--primary)}
.light-brand .intro{border-left-color:var(--primary)}
@media (max-width:700px){.sheet{padding:32px 22px}.parties,.grid2,.sign,.kv{grid-template-columns:1fr}.layer,.tl{grid-template-columns:1fr}.layer+.layer:before{left:10px}}
@media print{
  @page{size:A4;margin:16mm 15mm}
  html,body{background:#fff}
  .toolbar{display:none}
  .sheet{width:auto;margin:0;padding:0;box-shadow:none;border-radius:0}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`

function shell(title: string, content: GeneratedContent, brand: Brand, inner: string): string {
  // Les documents portent la charte Nira ; seul le logo du client y figure.
  const palette = paletteOf({ primary: '#0077FC', secondary: '#231F20' })
  const fonts = fontsOf('moderne')
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts.href}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@800&display=swap">
<style>
:root{${paletteCss(palette)};--f-head:${fonts.head};--f-body:${fonts.body};--f-mono:${fonts.mono};--hw:${fonts.headWeight};--tr:${fonts.tracking}}
${CSS}
</style>
</head>
<body class="${palette.lightBrand ? 'light-brand' : ''}">
<div class="toolbar"><button class="primary" onclick="window.print()">Télécharger en PDF</button></div>
<article class="sheet">${inner}</article>
<script>${PRINT_ON_HASH}</script>
</body>
</html>`
}

function docHead(brand: Brand, input: StudioInput): string {
  const client = brand.logo
    ? `<img src="${brand.logo}" alt="${esc(input.company)}">`
    : `<span class="client">${esc(input.company)}</span>`
  return `<header class="doc-head">${client}<span class="by">Proposé par ${niraMark(17, 'var(--ink)')}</span></header>`
}

const section = (n: number, title: string, body: string): string =>
  `<section><h2><span class="n">${String(n).padStart(2, '0')}</span>${esc(title)}</h2>${body}</section>`

const titledList = (items: { title: string; detail: string }[]): string =>
  `<ul class="list">${items.map((item) => `<li><b>${esc(item.title)} :</b> ${esc(item.detail)}</li>`).join('')}</ul>`

const boxes = (items: { title: string; detail: string }[]): string =>
  `<div class="grid2">${items.map((item) => `<div class="box"><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`).join('')}</div>`

/* ------------------------------------------------------------- propal */

export function renderProposal(content: GeneratedContent, brand: Brand, input: StudioInput): string {
  const { brief, proposal } = content
  const pricing = pricingOf(brief, input)
  const billing = input.billing
  const today = new Date()
  let n = 0

  const client = [
    `<b>${esc(billing.legalName || input.company)}</b>`,
    billing.siret ? `SIRET : ${esc(billing.siret)}` : '',
    esc(billing.address),
    esc(billing.postalCity),
    input.contact ? `À l'attention de ${esc(input.contact)}${input.contactRole ? `, ${esc(input.contactRole)}` : ''}` : '',
  ]
    .filter(Boolean)
    .join('<br>')

  const inner = `
    ${docHead(brand, input)}
    <p class="kicker">Proposition commerciale</p>
    <h1 class="title">${esc(proposal.title)}</h1>
    <p class="subtitle">${esc(proposal.objet)}</p>

    <div class="parties">
      <div class="party"><h3>Émetteur</h3>
        <b>${NIRA.name}</b><br>SIRET : ${NIRA.siret}<br>${NIRA.address}, ${NIRA.postalCity}<br>
        ${esc(input.seller.email || NIRA.email)}
      </div>
      <div class="party"><h3>Client</h3>${client}</div>
    </div>

    <table class="meta">
      <tr><td>Date</td><td>${longDate(today)}</td></tr>
      <tr><td>Objet</td><td>${esc(brief.objet)}</td></tr>
      <tr><td>Montant total</td><td class="amount">${money(pricing.total)} TTC (${NIRA.vatNote.split(',')[0]})</td></tr>
      <tr><td>Validité de l'offre</td><td>${pricing.validityDays} jours</td></tr>
    </table>

    <p class="intro">${esc(proposal.introduction)}</p>

    ${section(
      ++n,
      'Le constat et l’ambition',
      `${proposal.context.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}
      ${
        proposal.context.highlights.length
          ? `<div class="highlights">${proposal.context.highlights
              .map((item) => `<div class="hl"><strong>${esc(item.value)}</strong><span>${esc(item.label)}</span></div>`)
              .join('')}</div>`
          : ''
      }`,
    )}

    ${section(++n, 'Vos objectifs', boxes(proposal.objectives))}

    ${section(
      ++n,
      'Notre solution',
      `<p>${esc(proposal.solution.intro)}</p>
      <div class="grid2">${proposal.solution.blocks
        .map((block) => `<div class="box"><h3>${esc(block.title)}</h3><p>${esc(block.text)}</p></div>`)
        .join('')}</div>`,
    )}

    ${section(++n, 'Notre méthode', titledList(proposal.methodology))}

    ${section(
      ++n,
      'Livrables et prestations incluses',
      `<table class="data"><thead><tr><th style="width:38%">Livrable</th><th>Détail</th></tr></thead><tbody>
        ${proposal.deliverables
          .map(
            (group) =>
              `<tr><td class="strong">${esc(group.title)}</td><td><ul>${group.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></td></tr>`,
          )
          .join('')}
      </tbody></table>`,
    )}

    ${section(
      ++n,
      'Planning prévisionnel',
      `<div class="timeline">${proposal.planning
        .map((phase) => `<div class="tl"><span class="when">${esc(phase.duration)}</span><div><h3>${esc(phase.phase)}</h3><p>${esc(phase.detail)}</p></div></div>`)
        .join('')}</div>`,
    )}

    ${section(
      ++n,
      'Proposition financière',
      `<table class="data"><thead><tr><th>Prestation</th><th>Quantité</th><th class="num">Prix TTC</th><th class="num">Total TTC</th></tr></thead><tbody>
        ${pricing.lines
          .map(
            (line) =>
              `<tr><td><span class="strong">${esc(line.label)}</span>${line.description ? `<small>${esc(line.description)}</small>` : ''}</td><td>${esc(line.quantity)}</td><td class="num">${money(line.unitPrice)}</td><td class="num">${money(line.total)}</td></tr>`,
          )
          .join('')}
        <tr class="total"><td colspan="3" class="num">Total TTC (TVA non applicable)</td><td class="num">${money(pricing.total)}</td></tr>
      </tbody></table>
      <div class="terms"><b>Conditions financières et de règlement :</b>
        <ul class="list">${pricing.paymentTerms.map((term) => `<li>${esc(term)}</li>`).join('')}
          <li>Facture émise en franchise de TVA (art. 293 B du CGI). Règlement par virement bancaire.</li>
        </ul>
      </div>`,
    )}

    ${section(++n, 'Pourquoi Nira', boxes(proposal.whyUs))}

    ${proposal.conditions.length ? section(++n, 'Conditions', `<ul class="list">${proposal.conditions.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`) : ''}

    ${section(
      ++n,
      'Validation et signature',
      `<div class="sign">
        <div class="party"><h3>Pour Nira (prestataire)</h3>
          ${esc(input.seller.name || 'Nira')}<br>${esc(input.seller.email || NIRA.email)}<br>Date : ${today.toLocaleDateString('fr-FR')}
          <span class="line">Signature</span>
        </div>
        <div class="party"><h3>Pour le client (${esc(input.company)})</h3>
          <em>Faire précéder de la mention manuscrite « Bon pour accord »</em><br>
          Nom et fonction : ${esc([billing.signatory, billing.signatoryRole].filter(Boolean).join(', '))}<br>Date :
          <span class="line">Signature et cachet</span>
        </div>
      </div>`,
    )}

    <footer class="foot"><span>${NIRA.name} · SIRET ${NIRA.siret} · ${NIRA.vatNote}</span><span>${esc(input.company)} · ${longDate(today)}</span></footer>`

  return shell(`Proposition — ${input.company}`, content, brand, inner)
}

/* ------------------------------------------------- documentation technique */

export function renderTechDoc(content: GeneratedContent, brand: Brand, input: StudioInput): string {
  const doc = content.techdoc as TechDoc
  let n = 0

  const inner = `
    ${docHead(brand, input)}
    <p class="kicker">Documentation technique</p>
    <h1 class="title">${esc(doc.title)}</h1>
    <p class="subtitle">${esc(content.brief.objet)}</p>
    <p class="intro">${esc(doc.summary)}</p>

    ${section(++n, 'Périmètre', `<ul class="list">${doc.scope.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`)}

    ${section(
      ++n,
      'Architecture',
      `<p>${esc(doc.architecture.overview)}</p>
      <div class="layers">${doc.architecture.layers
        .map(
          (layer) => `
          <div class="layer">
            <div class="layer-name">${esc(layer.name)}</div>
            <div class="layer-items">${layer.components
              .map((comp) => `<div class="comp"><b>${esc(comp.name)}</b><span>${esc(comp.role)}</span>${comp.tech ? `<code>${esc(comp.tech)}</code>` : ''}</div>`)
              .join('')}</div>
          </div>`,
        )
        .join('')}</div>`,
    )}

    ${section(
      ++n,
      'Flux de données',
      `<table class="data"><thead><tr><th>Flux</th><th>Origine → destination</th><th>Données</th><th>Fréquence</th></tr></thead><tbody>
        ${doc.flows
          .map((flow) => `<tr><td class="strong">${esc(flow.step)}</td><td>${esc(flow.from)} → ${esc(flow.to)}</td><td>${esc(flow.data)}</td><td>${esc(flow.frequency)}</td></tr>`)
          .join('')}
      </tbody></table>`,
    )}

    ${
      doc.tools.length
        ? section(
            ++n,
            'Outils',
            doc.tools
              .map(
                (tool) => `
          <div class="tool">
            <div class="tool-head"><h3>${esc(tool.name)}</h3><span class="chip">${esc(tool.category)}</span></div>
            <p>${esc(tool.purpose)}</p>
            <ul class="list">${tool.features.map((feature) => `<li>${esc(feature)}</li>`).join('')}</ul>
            <div class="kv">
              <div><small>Intégration</small>${esc(tool.integration)}</div>
              <div><small>Hébergement</small>${esc(tool.hosting)}</div>
              <div><small>Licence</small>${esc(tool.licence)}</div>
            </div>
          </div>`,
              )
              .join(''),
          )
        : ''
    }

    ${section(++n, 'Données, sécurité et conformité', boxes(doc.dataAndSecurity))}

    ${section(
      ++n,
      'Mise en service',
      `<div class="steps">${doc.deployment.map((step) => `<div class="stepi"><div><h3>${esc(step.step)}</h3><p>${esc(step.detail)}</p></div></div>`).join('')}</div>`,
    )}

    ${section(++n, 'Exploitation et maintenance', titledList(doc.operations))}

    ${section(++n, 'Prérequis côté client', `<ul class="list">${doc.prerequisites.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`)}

    ${section(
      ++n,
      'Risques et parades',
      `<table class="data"><thead><tr><th style="width:42%">Risque</th><th>Parade</th></tr></thead><tbody>
        ${doc.risks.map((risk) => `<tr><td class="strong">${esc(risk.risk)}</td><td>${esc(risk.mitigation)}</td></tr>`).join('')}
      </tbody></table>`,
    )}

    <footer class="foot"><span>Document établi par ${NIRA.name} pour ${esc(input.company)}</span><span>${longDate()}</span></footer>`

  return shell(`Documentation technique — ${input.company}`, content, brand, inner)
}
