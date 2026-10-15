import type { GeneratedContent, NiraDeck, NiraIconName, SaleKind, StudioInput } from '../model.js'
import { esc, money } from '../theme.js'
import { pricingOf } from './common.js'
import { FREE_CSS, FREE_SCRIPT } from './deck.js'
import { NIRA_ASSETS as A, NIRA_CLIENT_LOGOS, NIRA_ICONS } from './niraAssets.js'

/**
 * Présentation commerciale au gabarit Nira.
 *
 * Reproduit la présentation de référence (positions, tailles et couleurs
 * relevées dans le fichier PowerPoint, toile de 1600 × 900) : les slides fixes
 * sont celles de Nira, avec une variante pour la vente de logiciel ; les slides
 * consacrées au besoin du client sont écrites par le modèle.
 */

const BLUE = '#0077FC'
const BLACK = '#231F20'
const GREY = '#F5F5F5'
const RED = '#FF2828'

type Ctx = { client: string; sale: SaleKind; year: number }

const icon = (name: NiraIconName | 'arrowDown', color: string, size: number) =>
  `<i class="n-ic" style="width:${size}px;height:${size}px;background:${color};-webkit-mask-image:url(${NIRA_ICONS[name]});mask-image:url(${NIRA_ICONS[name]})"></i>`

function header(ctx: Ctx, variant: 'light' | 'blue' | 'red' | 'plain' = 'light'): string {
  const onColor = variant === 'blue' || variant === 'red'
  const arrow =
    variant === 'plain' || variant === 'red'
      ? ''
      : `<span class="n-next${onColor ? ' on-color' : ''}"><img src="${A.arrow}" alt=""></span>`
  return `
    <img class="n-star" src="${onColor ? A.starWhite : A.star}" alt="">
    <span class="n-brand${onColor ? ' on-color' : ''}">Nira - ${esc(ctx.client)}</span>
    ${arrow}`
}

const slide = (cls: string, html: string, label: string) =>
  `<section class="slide n-slide ${cls}" aria-label="${esc(label)}"><div class="n-inner">${html}</div></section>`

/* ------------------------------------------------------------ fixes */

function cover(ctx: Ctx): string {
  return slide(
    'n-cover',
    `<img class="n-blob" src="${A.blob}" style="left:290px;top:-796px;width:1177px;height:1174px" alt="">
     <img class="n-blob" src="${A.blob}" style="left:-44px;top:705px;width:679px;height:677px" alt="">
     ${header(ctx)}
     <h1 class="n-cover-title">Automatisation stratégique</h1>
     <p class="n-cover-sub">${ctx.sale === 'audit' ? 'Des solutions sur-mesure alimentées par l’ia.' : 'Des outils sur-mesure alimentés par l’ia.'}</p>
     <span class="n-cover-foot">Nira · ${esc(ctx.client)} · ${ctx.year}</span>`,
    'Couverture',
  )
}

function interlude(): string {
  return slide(
    'n-interlude',
    `<img class="n-blob" src="${A.blob}" style="left:290px;top:-796px;width:1177px;height:1174px" alt="">
     <img class="n-blob" src="${A.blob}" style="left:-45px;top:643px;width:679px;height:677px" alt="">`,
    'Transition',
  )
}

function approach(ctx: Ctx): string {
  const items: [string, string, string, number, number][] = [
    [A.approachMetier, 'Vision métier', 'Comprendre les enjeux opérationnels et identifier les leviers de performance.', 730, 110],
    [A.approachDesign, 'Conception sur-mesure', 'Imaginer et concevoir des solutions adaptées aux contextes, aux équipes et aux usages.', 1163, 110],
    [A.approachSpeed, 'Accélération par l’IA', 'Utiliser l’IA pour automatiser, simplifier et gagner en efficacité au quotidien.', 730, 464],
    [A.approachImpact, 'Impact durable', 'Déployer des outils utiles, pérennes et réellement appropriables par les organisations.', 1163, 464],
  ]
  return slide(
    'n-approach',
    `${header(ctx)}
     <h2 class="n-approach-title">Notre<br>approche</h2>
     <p class="n-approach-text">Nous accompagnons les organisations dans la création d’outils internes alimentés par l’ia, utiles et adaptés à leurs contraintes opérationnelles.</p>
     ${items
       .map(
         ([src, title, text, x, y]) => `
       <div class="n-approach-item" style="left:${x}px;top:${y}px">
         <img src="${src}" alt=""><b>${title}</b><p>${text}</p>
       </div>`,
       )
       .join('')}`,
    'Notre approche',
  )
}

function references(ctx: Ctx): string {
  return slide(
    'n-refs',
    `${header(ctx)}
     <h2 class="n-title" style="top:150px">Ils nous font confiance</h2>
     <div class="n-logos">${NIRA_CLIENT_LOGOS.map((logo) => `<div><img src="${logo}" alt=""></div>`).join('')}</div>`,
    'Ils nous font confiance',
  )
}

function statement(ctx: Ctx): string {
  const [ask, real] =
    ctx.sale === 'audit'
      ? ['Les entreprises cherchent souvent directement :<br>"Construisons un agent IA"', 'Alors que la vraie question est :<br>Quel processus mérite réellement un agent IA ?']
      : ['Les entreprises empilent souvent les outils :<br>"Ajoutons encore un logiciel"', 'Alors que la vraie question est :<br>Quel outil vos équipes utiliseront vraiment ?']
  return slide(
    'n-blue',
    `${header(ctx, 'blue')}
     <div class="n-statement"><p>${ask}</p><p>${real}</p></div>`,
    'La vraie question',
  )
}

function warning(ctx: Ctx): string {
  const [title, pills] =
    ctx.sale === 'audit'
      ? ['Sans cartographie :', ['mauvais ROI', 'mauvais choix techniques', 'automatisations peu utilisées']]
      : ['Sans outil sur-mesure :', ['ressaisies sans fin', 'outils non adoptés', 'données dispersées']]
  return slide(
    'n-red',
    `${header(ctx, 'red')}
     <p class="n-red-title">${title}</p>
     <div class="n-red-pills"><div>${pills
       .slice(0, 2)
       .map((pill) => `<span>${pill}</span>`)
       .join('')}</div><div><span>${pills[2]}</span></div></div>`,
    title,
  )
}

const AUDIT_DELIVERABLES: [NiraIconName, string][] = [
  ['map', 'Cartographie des processus'],
  ['bulb', 'Liste des opportunités IA'],
  ['chart', 'Estimation du ROI'],
  ['gauge', 'Niveau de difficulté'],
  ['bolt', 'Quick wins'],
  ['route', 'Roadmap de déploiement'],
  ['clipboard', 'Catalogue des automatisations'],
]

function tiles(ctx: Ctx, title: string, items: { icon: NiraIconName; title: string; text?: string }[]): string {
  const rows = items.length > 4 ? [items.slice(0, 4), items.slice(4)] : [items]
  return slide(
    'n-tiles',
    `${header(ctx)}
     <h2 class="n-title" style="top:120px">${title}</h2>
     <div class="n-tile-rows">${rows
       .map(
         (row) =>
           `<div class="n-tile-row">${row
             .map(
               (item) =>
                 `<div class="n-tile"><span class="n-tile-ic">${icon(item.icon, BLUE, 44)}</span><b>${esc(item.title)}</b>${item.text ? `<p>${esc(item.text)}</p>` : ''}</div>`,
             )
             .join('')}</div>`,
       )
       .join('')}</div>`,
    title,
  )
}

function methodology(ctx: Ctx): string {
  const steps: [NiraIconName, string][] =
    ctx.sale === 'logiciel'
      ? [['compass', 'Cadrage'], ['people', 'Ateliers'], ['map', 'Conception'], ['layers', 'Développement'], ['search', 'Tests'], ['handshake', 'Déploiement']]
      : [['compass', 'Découverte'], ['people', 'Entretiens'], ['map', 'Cartographie'], ['search', 'Analyse'], ['bulb', 'Opportunités'], ['handshake', 'Restitution']]
  return slide(
    'n-method',
    `${header(ctx)}
     <h2 class="n-title" style="top:240px">Notre méthodologie</h2>
     <div class="n-steps">${steps
       .map(
         ([name, label], i) => `
       <div class="n-step">
         <span class="n-step-dot" style="background:${i % 2 ? BLUE : BLACK}">${icon(name, '#fff', 60)}<em style="background:${i % 2 ? BLACK : BLUE}">${i + 1}</em></span>
         <b>${label}</b>
       </div>`,
       )
       .join('')}</div>`,
    'Notre méthodologie',
  )
}

function afterwards(ctx: Ctx): string {
  const [title, cards]: [string, [string, string, NiraIconName][]] =
    ctx.sale === 'audit'
      ? [
          'Et ensuite ?<br>Vous restez totalement libres.',
          [
            ['Développer en interne', 'Vous exécutez la roadmap avec vos propres équipes IA.', 'brain'],
            ['Travailler avec Nira', 'Nous concevons et déployons les automatisations avec vous.', 'handshake'],
            ['Mixer les deux', 'Vous gardez la main, nous intervenons sur des chantiers ciblés.', 'layers'],
          ],
        ]
      : [
          'Et après la mise en service ?<br>Nous restons à vos côtés.',
          [
            ['Formation des équipes', 'Vos équipes prennent l’outil en main dès le premier jour.', 'people'],
            ['Maintenance et suivi', 'Nous surveillons, corrigeons et faisons évoluer la solution.', 'handshake'],
            ['Nouvelles briques', 'Vous étendez l’outil à d’autres processus quand vous le décidez.', 'layers'],
          ],
        ]
  const styles = [
    { bg: GREY, fg: BLACK, ic: BLUE },
    { bg: BLUE, fg: '#fff', ic: '#fff' },
    { bg: BLACK, fg: '#fff', ic: '#fff' },
  ]
  return slide(
    'n-after',
    `${header(ctx)}
     <h2 class="n-title" style="top:110px;color:#333">${title}</h2>
     <div class="n-cards3">${cards
       .map(([cardTitle, text, name], i) => {
         const s = styles[i]
         return `<div class="n-card" style="background:${s.bg};color:${s.fg}">
           <div class="n-card-top"><span class="n-num">0${i + 1}.</span>${icon(name, s.ic, 56)}</div>
           <b>${cardTitle}</b><p>${text}</p></div>`
       })
       .join('')}</div>`,
    'Et ensuite',
  )
}

function offerTitle(ctx: Ctx): string {
  return slide('n-offer-title', `${header(ctx, 'plain')}<h2 class="n-big">Offre</h2>`, 'Offre')
}

/* ------------------------------------------------- besoin du client */

function understood(ctx: Ctx, deck: NiraDeck): string {
  return slide(
    'n-understood',
    `${header(ctx)}
     <h2 class="n-title" style="top:191px;color:#333">Ce que nous avons compris</h2>
     <p class="n-subtitle">${esc(deck.understood.intro)}</p>
     <div class="n-pills">${deck.understood.pills.slice(0, 4).map((pill) => `<span>${esc(pill)}</span>`).join('')}</div>`,
    'Ce que nous avons compris',
  )
}

function figures(ctx: Ctx, deck: NiraDeck): string {
  const list = deck.figures.slice(0, 4)
  return slide(
    'n-figures',
    `${header(ctx)}
     <h2 class="n-title" style="top:150px;color:#333">Vos enjeux en chiffres</h2>
     <div class="n-figs" style="grid-template-columns:repeat(${list.length},minmax(0,1fr))">${list
       .map(
         (fig, i) => `<div class="n-fig${i === 0 ? ' is-blue' : ''}"><strong style="font-size:${fig.value.length > 5 ? 66 : 84}px">${esc(fig.value)}</strong><b>${esc(fig.label)}</b><p>${esc(fig.detail)}</p></div>`,
       )
       .join('')}</div>`,
    'Vos enjeux en chiffres',
  )
}

function quote(ctx: Ctx, deck: NiraDeck): string {
  return slide(
    'n-quote',
    `${header(ctx)}
     <span class="n-quote-mark">“</span>
     <blockquote>${esc(deck.quote.text)}</blockquote>
     <cite>${esc(deck.quote.author)}</cite>`,
    'Ce que vous nous avez dit',
  )
}

function opportunities(ctx: Ctx, deck: NiraDeck): string {
  const styles = [
    { bg: BLUE, fg: GREY },
    { bg: BLACK, fg: GREY },
    { bg: GREY, fg: BLACK },
  ]
  return slide(
    'n-opps',
    `${header(ctx)}
     <h2 class="n-title" style="top:157px;width:1100px;color:#333">Les opportunités que nous avons identifiées</h2>
     <div class="n-cards3 is-low">${deck.opportunities
       .slice(0, 3)
       .map((item, i) => {
         const s = styles[i]
         return `<div class="n-card" style="background:${s.bg};color:${s.fg}"><span class="n-num big">0${i + 1}.</span><b>${esc(item.title)}</b><p>${esc(item.text)}</p></div>`
       })
       .join('')}</div>`,
    'Opportunités',
  )
}

function flow(ctx: Ctx, item: NiraDeck['flows'][number]): string {
  const row = (steps: string[], ai: boolean) =>
    steps
      .map((step, i) => `${i ? `<span class="n-chev${ai ? ' is-ai' : ''}">›</span>` : ''}<span class="n-box${ai ? ' is-ai' : ''}">${esc(step)}</span>`)
      .join('')
  return slide(
    'n-flow',
    `${header(ctx)}
     ${item.title ? `<h2 class="n-flow-title">${esc(item.title)}</h2>` : ''}
     <div class="n-flow-grid">
       <span class="n-flow-label">Aujourd'hui</span><div class="n-flow-row">${row(item.today, false)}</div>
       <span></span><div class="n-flow-down"><span>${icon('arrowDown', '#fff', 34)}</span></div>
       <span class="n-flow-label is-ai">Avec l’ia</span><div class="n-flow-row">${row(item.withAi, true)}</div>
     </div>`,
    item.title || 'Aujourd’hui et avec l’IA',
  )
}

function leads(ctx: Ctx, deck: NiraDeck): string {
  const styles = [
    { bg: BLUE, fg: '#cfe4ff', title: '#fff' },
    { bg: GREY, fg: '#333', title: BLACK },
    { bg: BLACK, fg: GREY, title: '#fff' },
    { bg: GREY, fg: '#333', title: BLACK },
  ]
  const list = deck.leads.slice(0, 4)
  return slide(
    'n-leads',
    `${header(ctx)}
     <h2 class="n-title" style="top:140px;width:1000px;color:#333">Quelques pistes déjà identifiées</h2>
     <div class="n-cards4" style="grid-template-columns:repeat(${list.length},1fr)">${list
       .map((item, i) => {
         const s = styles[i % styles.length]
         return `<div class="n-card" style="background:${s.bg};color:${s.fg}"><span class="n-num mid" style="color:${s.title}">0${i + 1}.</span><b style="color:${s.title}">${esc(item.title)}</b><p>${esc(item.text)}</p></div>`
       })
       .join('')}</div>`,
    'Pistes identifiées',
  )
}

function pricing(ctx: Ctx, deck: NiraDeck, total: number): string {
  return slide(
    'n-price',
    `<img class="n-blob" src="${A.blob}" style="left:-20px;top:135px;width:1449px;height:1446px" alt="">
     ${header(ctx, 'plain')}
     <div class="n-offer">
       <h3>${esc(deck.offer.name)}</h3>
       <span class="n-price-pill">${esc(money(total).replace(/\s(?=\d)/g, '.'))}</span>
       <p>${esc(deck.offer.description)}</p>
       <div class="n-offer-list">${deck.offer.includes.map((item) => esc(item)).join('<br>')}</div>
     </div>`,
    'Proposition',
  )
}

/* --------------------------------------------------------------- styles */

const CSS = `
.n-slide{background:#fff;color:#000;font-family:'Inter Tight','Inter',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.n-inner{position:absolute;left:0;top:0;width:1600px;height:900px;overflow:hidden}
.n-inner>*{position:absolute}
.n-blob{pointer-events:none;object-fit:contain}
.n-star{left:83px;top:49px;width:34px;height:34px}
.n-brand{left:135px;top:49px;font:700 22px/34px 'Inter Tight',Arial,sans-serif;color:#000;white-space:nowrap}
.n-brand.on-color{color:#fff}
.n-next{left:1461px;top:41px;width:56px;height:42px;border-radius:21px;background:${BLUE};display:grid;place-items:center}
.n-next img{width:27px;height:21px;transform:scaleX(-1)}
.n-next.on-color{background:transparent}
.n-title{left:83px;margin:0;font:500 100px/1.05 'Inter Tight',Arial,sans-serif;letter-spacing:-.035em;color:#000;width:1434px}
.n-subtitle{left:83px;top:306px;margin:0;font:300 57px/1.1 'Inter Tight',Arial,sans-serif;letter-spacing:-.02em;color:#333;width:1300px}
.n-num{font:700 56px/1 'Inter Tight',Arial,sans-serif;letter-spacing:-.03em}
.n-num.big{font-size:100px;letter-spacing:-.04em}
.n-num.mid{font-size:48px}
.n-ic{display:inline-block;flex:none;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}

/* couverture */
.n-cover-title{left:83px;top:314px;margin:0;font:500 118px/1.2 'Inter Tight',Arial,sans-serif;letter-spacing:-.04em;white-space:nowrap}
.n-cover-sub{left:83px;top:491px;margin:0;font:300 44px/1.3 'Inter Tight',Arial,sans-serif;letter-spacing:-.02em;color:#3a3a3a}
.n-cover-foot{left:83px;top:811px;font:700 22px/31px 'Inter Tight',Arial,sans-serif}

/* approche */
.n-approach-title{left:83px;top:220px;margin:0;font:500 139px/1.02 'Inter Tight',Arial,sans-serif;letter-spacing:-.045em}
.n-approach-text{left:83px;top:550px;width:470px;margin:0;font:400 22px/1.45 'Inter Tight',Arial,sans-serif}
.n-approach-item{width:360px}
.n-approach-item img{height:60px;width:auto;display:block;margin-bottom:14px}
.n-approach-item b{display:block;font:700 29px/1.3 'Inter Tight',Arial,sans-serif;letter-spacing:-.01em;margin-bottom:46px}
.n-approach-item p{margin:0;font:400 20px/1.4 'Inter Tight',Arial,sans-serif}

/* références */
.n-logos{left:83px;top:330px;width:1434px;display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
.n-logos div{height:225px;border-radius:40px;background:${GREY};display:grid;place-items:center;padding:30px 36px}
.n-logos img{max-width:100%;max-height:150px;object-fit:contain}

/* compris */
.n-pills{left:100px;top:420px;width:1400px;display:flex;flex-wrap:wrap;gap:30px 40px}
.n-pills span{display:inline-flex;align-items:center;height:96px;padding:0 38px;border-radius:26px;background:${BLUE};color:#fff;font:700 42px/1 'Inter Tight',Arial,sans-serif;letter-spacing:-.02em;white-space:nowrap}

/* chiffres */
.n-figs{left:83px;top:400px;width:1434px;display:grid;gap:22px}
.n-fig{background:${GREY};border-radius:22px;padding:44px 40px;min-height:340px;display:flex;flex-direction:column}
.n-fig strong{font:700 84px/1 'Inter Tight',Arial,sans-serif;letter-spacing:-.045em;color:${BLUE};white-space:nowrap}
.n-fig b{margin-top:auto;font:700 29px/1.25 'Inter Tight',Arial,sans-serif;color:${BLACK}}
.n-fig p{margin:10px 0 0;font:400 20px/1.4 'Inter Tight',Arial,sans-serif;color:#555}
.n-fig.is-blue{background:${BLUE}}.n-fig.is-blue strong,.n-fig.is-blue b{color:#fff}.n-fig.is-blue p{color:#d4e7ff}

/* citation */
.n-quote-mark{left:76px;top:150px;font:700 260px/1 'Inter Tight',Arial,sans-serif;color:${BLUE}}
.n-quote blockquote{left:83px;top:330px;width:1380px;margin:0;font:500 76px/1.12 'Inter Tight',Arial,sans-serif;letter-spacing:-.035em;color:#333}
.n-quote cite{left:83px;top:760px;font:700 26px/1 'Inter Tight',Arial,sans-serif;font-style:normal;color:${BLUE}}

/* cartes */
.n-cards3{left:82px;top:430px;width:1437px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.n-cards3.is-low{top:411px}
.n-card{border-radius:22px;padding:34px 36px;min-height:325px;display:flex;flex-direction:column}
.n-card b{font:700 29px/1.25 'Inter Tight',Arial,sans-serif;letter-spacing:-.01em;margin:18px 0 12px}
.n-card p{margin:0;font:400 20px/1.4 'Inter Tight',Arial,sans-serif;opacity:.95}
.n-card-top{display:flex;justify-content:space-between;align-items:center}
.n-cards4{left:83px;top:430px;width:1434px;display:grid;gap:18px}
.n-cards4 .n-card{min-height:400px}
.n-cards4 .n-card p{font-size:22px}

/* rupture bleue et rouge */
.n-blue{background:${BLUE}}
.n-statement{left:110px;top:0;width:1380px;height:900px;display:flex;flex-direction:column;justify-content:center;gap:72px;text-align:center;color:#fff}
.n-statement p{margin:0;font:700 51px/1.2 'Inter Tight',Arial,sans-serif;letter-spacing:-.02em}
.n-red{background:${RED}}
.n-red-title{left:0;top:302px;width:1600px;margin:0;text-align:center;color:#fff;font:700 51px/1 'Inter Tight',Arial,sans-serif;letter-spacing:-.02em}
.n-red-pills{left:0;top:424px;width:1600px;display:flex;flex-direction:column;align-items:center;gap:13px}
.n-red-pills div{display:flex;gap:10px}
.n-red-pills span{height:109px;padding:0 48px;border-radius:30px;background:${GREY};color:${RED};display:inline-flex;align-items:center;font:700 48px/1 'Inter Tight',Arial,sans-serif;letter-spacing:-.02em}

/* processus */
.n-flow-title{left:83px;top:130px;margin:0;font:500 64px/1.1 'Inter Tight',Arial,sans-serif;letter-spacing:-.03em;color:#333;width:1434px}
.n-flow-grid{left:83px;top:250px;width:1434px;height:560px;display:grid;grid-template-columns:200px 1fr;grid-template-rows:1fr 120px 1fr;align-items:center;column-gap:10px}
.n-flow-label{font:700 29px/1.2 'Inter Tight',Arial,sans-serif;color:#606060}
.n-flow-label.is-ai{color:${BLUE}}
.n-flow-row{display:flex;align-items:center;gap:6px}
.n-box{flex:1;min-width:0;min-height:96px;padding:12px 10px;border-radius:14px;background:${GREY};color:#333;display:grid;place-items:center;text-align:center;font:700 21px/1.2 'Inter Tight',Arial,sans-serif}
.n-box.is-ai{background:${BLUE};color:#fff}
.n-chev{font:400 34px/1 'Inter Tight',Arial,sans-serif;color:#606060;flex:none}
.n-chev.is-ai{color:${BLUE}}
.n-flow-down{display:flex;justify-content:center}
.n-flow-down span{width:72px;height:72px;border-radius:50%;background:${BLUE};display:grid;place-items:center}

/* livrables et fonctionnalités */
.n-tile-rows{left:60px;top:420px;width:1480px;display:flex;flex-direction:column;gap:22px;align-items:center}
.n-tile-row{display:flex;gap:22px;justify-content:center;width:100%}
.n-tile{flex:0 0 352px;min-height:190px;border-radius:24px;background:${GREY};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}
.n-tile-ic{width:76px;height:76px;border-radius:50%;background:#E5F1FE;display:grid;place-items:center}
.n-tile b{font:700 24px/1.25 'Inter Tight',Arial,sans-serif;color:#231F20}
.n-tile p{margin:0;font:400 18px/1.4 'Inter Tight',Arial,sans-serif;color:#555}

/* méthode */
.n-steps{left:150px;top:470px;width:1300px;display:flex;justify-content:space-between;position:absolute}
.n-steps:before{content:'';position:absolute;left:80px;right:80px;top:72px;height:3px;background:#e2e2e2}
.n-step{position:relative;display:flex;flex-direction:column;align-items:center;gap:26px;width:170px}
.n-step-dot{position:relative;width:145px;height:145px;border-radius:50%;display:grid;place-items:center}
.n-step-dot em{position:absolute;right:-6px;top:-6px;width:46px;height:46px;border-radius:50%;border:4px solid #fff;color:#fff;display:grid;place-items:center;font:700 20px/1 'Inter Tight',Arial,sans-serif;font-style:normal}
.n-step b{font:700 26px/1.2 'Inter Tight',Arial,sans-serif;color:#231F20;white-space:nowrap}

/* offre */
.n-big{left:0;top:0;width:1600px;height:900px;margin:0;display:grid;place-items:center;font:500 220px/1 'Inter Tight',Arial,sans-serif;letter-spacing:-.05em;color:#231F20}
.n-offer{left:470px;top:150px;width:660px;padding:50px 56px 56px;border-radius:44px;background:rgba(245,245,245,.92);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;gap:28px;text-align:center}
.n-offer h3{margin:0;font:500 58px/1.05 'Inter Tight',Arial,sans-serif;letter-spacing:-.03em;color:#231F20}
.n-price-pill{padding:8px 28px;border-radius:20px;background:${BLUE};color:${GREY};font:700 46px/1.2 'Inter Tight',Arial,sans-serif;letter-spacing:-.02em}
.n-offer p{margin:0;font:300 26px/1.35 'Inter Tight',Arial,sans-serif;color:#231F20}
.n-offer-list{width:100%;padding:24px 22px;border-radius:16px;background:#333;color:#fff;font:300 27px/1.45 'Inter Tight',Arial,sans-serif}
`

export function renderNiraDeck(content: GeneratedContent, input: StudioInput): string {
  const deck = content.deck as NiraDeck
  const ctx: Ctx = { client: input.company, sale: input.sale, year: new Date().getFullYear() }
  const { total } = pricingOf(content.brief, input)

  const slides: string[] = [cover(ctx), interlude(), approach(ctx), references(ctx), understood(ctx, deck)]
  if (deck.figures.length) slides.push(figures(ctx, deck))
  if (deck.quote.text.trim()) slides.push(quote(ctx, deck))
  slides.push(opportunities(ctx, deck), statement(ctx), warning(ctx))
  deck.flows.slice(0, 2).forEach((item) => slides.push(flow(ctx, item)))
  if (deck.leads.length) slides.push(leads(ctx, deck))
  if (ctx.sale !== 'audit' && deck.build.length) {
    slides.push(tiles(ctx, 'Ce que nous allons construire', deck.build.slice(0, 7).map((item) => ({ ...item }))))
  }
  if (ctx.sale !== 'logiciel') {
    slides.push(tiles(ctx, 'Ce que vous obtenez à la fin de l’audit', AUDIT_DELIVERABLES.map(([name, title]) => ({ icon: name, title }))))
  }
  slides.push(methodology(ctx), afterwards(ctx), offerTitle(ctx), pricing(ctx, deck, total))

  const numbered = slides
    .map((html, index) => html.replace('</div></section>', `</div><span class="pageno">${String(index + 1).padStart(2, '0')}</span></section>`))
    .join('')
  const nonce = Math.random().toString(36).slice(2)

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:">
<title>Nira - ${esc(input.company)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700&family=DM+Mono:wght@500&display=swap">
<style>
:root{--ink:${BLACK};--muted:#606060;--primary:${BLUE};--bg:#fff;--f-body:'Inter Tight',Arial,sans-serif}
${FREE_CSS}
${CSS}
.pageno{color:#9a9a9a;mix-blend-mode:normal}
.n-blue .pageno,.n-red .pageno{color:rgba(255,255,255,.7)}
</style>
</head>
<body>
<div class="bar"></div>
<main class="viewport"><div class="stage">${numbered}</div></main>
<nav class="controls idle">
  <button id="prev" aria-label="Slide précédente">←</button>
  <span class="pos"></span>
  <button id="next" aria-label="Slide suivante">→</button>
  <button id="full" title="Plein écran (F)">⛶</button>
  <button id="pdf" title="Exporter en PDF">PDF</button>
</nav>
<script nonce="${nonce}">${FREE_SCRIPT}</script>
</body>
</html>`
}
