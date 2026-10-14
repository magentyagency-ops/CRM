import type { Brand, GeneratedContent, Slide, StudioInput } from '../model.js'
import { esc, fontsOf, lines, longDate, money, niraMark, paletteCss, paletteOf } from '../theme.js'
import { pricingOf } from './common.js'

/**
 * Présentation commerciale : un fichier HTML autonome, au format 16:9.
 *
 * Les slides sont dessinées sur une scène fixe de 1600 × 900 mise à l'échelle
 * de l'écran : la mise en page est identique sur un portable, un écran de salle
 * ou en PDF. Une slide trop chargée réduit son contenu au lieu de déborder.
 */

const W = 1600
const H = 900

const pad = (value: number) => String(value).padStart(2, '0')

function highlightTitle(title: string, highlight: string): string {
  const html = lines(title)
  const needle = esc(highlight.trim())
  if (!needle) return html
  const index = html.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) return html
  return `${html.slice(0, index)}<span class="hl">${html.slice(index, index + needle.length)}</span>${html.slice(index + needle.length)}`
}

function statement(text: string): string {
  return text.trim() ? `<div class="statement"><span>${esc(text)}</span></div>` : ''
}

interface Ctx {
  brand: Brand
  input: StudioInput
  content: GeneratedContent
  total: number
  index: number
  count: number
}

function header(slide: Slide, ctx: Ctx): string {
  const logo = ctx.brand.logo
    ? `<img class="logo" src="${ctx.brand.logo}" alt="${esc(ctx.input.company)}"><span class="sep"></span>`
    : `<b class="client-name">${esc(ctx.input.company)}</b><span class="sep"></span>`
  return `
    <header class="top">
      <div class="brand">${logo}<span class="kicker">${esc(slide.kicker)}</span></div>
      <div class="count"><b>${pad(ctx.index + 1)}</b> / ${pad(ctx.count)}</div>
    </header>`
}

function body(slide: Slide, ctx: Ctx): string {
  switch (slide.layout) {
    case 'cover':
      return ''

    case 'context':
      return `
        <div class="split">
          <div>
            <h2>${lines(slide.title)}</h2>
            <p class="lede">${esc(slide.text)}</p>
          </div>
          <ol class="numbered">
            ${slide.bullets.map((bullet, i) => `<li><span>${pad(i + 1)}</span><p>${esc(bullet)}</p></li>`).join('')}
          </ol>
        </div>`

    case 'quote':
      return `
        <figure class="quote">
          <span class="mark">“</span>
          <blockquote>${esc(slide.quote)}</blockquote>
          <figcaption>${esc(slide.speaker)}</figcaption>
          ${slide.comment ? `<p class="comment">${esc(slide.comment)}</p>` : ''}
        </figure>`

    case 'stats':
      return `
        <h2>${lines(slide.title)}</h2>
        <div class="statgrid">
          <div class="bigstat">
            <strong>${esc(slide.figure.value)}</strong>
            <span>${esc(slide.figure.label)}</span>
            <small>${esc(slide.figure.caption)}</small>
          </div>
          <div class="problem">${slide.points.map((point) => `<div>${esc(point)}</div>`).join('')}</div>
        </div>`

    case 'pains':
      return `
        <h2>${lines(slide.title)}</h2>
        <div class="cards cols-${Math.min(4, Math.max(2, slide.items.length))}">
          ${slide.items
            .map(
              (item, i) => `
            <article class="card pain">
              <span class="num">${pad(i + 1)}</span>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.detail)}</p>
            </article>`,
            )
            .join('')}
        </div>`

    case 'versus':
      return `
        <h2>${lines(slide.title)}</h2>
        <div class="versus">
          <article class="vcard">
            <span class="label">${esc(slide.before.label)}</span>
            <strong>${esc(slide.before.value)}</strong>
            <p>${esc(slide.before.text)}</p>
          </article>
          <span class="vs">VS</span>
          <article class="vcard future">
            <span class="label">${esc(slide.after.label)}</span>
            <strong>${esc(slide.after.value)}</strong>
            <p>${esc(slide.after.text)}</p>
          </article>
        </div>`

    case 'flow':
      return `
        <h2>${lines(slide.title)}</h2>
        <div class="flow">
          ${slide.steps
            .map(
              (step, i) => `
            ${i ? '<span class="arrow">→</span>' : ''}
            <div class="node${i === slide.steps.length - 1 ? ' last' : ''}">
              <span class="num">${pad(i + 1)}</span>
              <b>${esc(step.title)}</b>
              <span>${esc(step.caption)}</span>
            </div>`,
            )
            .join('')}
        </div>`

    case 'pillars':
      return `
        <div class="pillars">
          <div>
            <h2>${lines(slide.title)}</h2>
            <p class="lede">${esc(slide.intro)}</p>
          </div>
          <div class="qualitymap">
            ${slide.items
              .map((item, i) => `<div class="q q${(i % 4) + 1}"><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div>`)
              .join('')}
          </div>
        </div>`

    case 'results':
      return `
        <h2>${lines(slide.title)}</h2>
        <div class="results cols-${Math.min(4, Math.max(2, slide.items.length))}">
          ${slide.items
            .map(
              (item) => `
            <div class="result">
              <span class="value">${esc(item.value)}</span>
              <div><b>${esc(item.title)}</b><span>${esc(item.detail)}</span></div>
            </div>`,
            )
            .join('')}
        </div>`

    case 'roadmap':
      return `
        <h2>${lines(slide.title)}</h2>
        <div class="roadmap cols-${Math.min(4, Math.max(2, slide.phases.length))}">
          ${slide.phases
            .map(
              (phase, i) => `
            <article class="phase">
              <div class="phase-head"><span class="phase-no">PHASE ${pad(i + 1)}</span><span class="dur">${esc(phase.duration)}</span></div>
              <h3>${esc(phase.name)}</h3>
              <p>${esc(phase.detail)}</p>
            </article>`,
            )
            .join('')}
        </div>`

    case 'offer':
      return `
        <h2>${lines(slide.title)}</h2>
        <div class="offer">
          <article class="offer-main">
            <span class="eyebrow-light">${esc(slide.kicker)}</span>
            <h3>${esc(slide.offerName)}</h3>
            <p>${esc(slide.pitch)}</p>
            <div class="price"><strong>${money(ctx.total)}</strong><span>TTC</span></div>
            ${slide.priceNote ? `<small>${esc(slide.priceNote)}</small>` : ''}
          </article>
          <div class="offer-list">${slide.includes.map((item) => `<div class="offer-item">${esc(item)}</div>`).join('')}</div>
        </div>`

    case 'closing':
      return `
        <h2 class="closing-title">${lines(slide.title)}</h2>
        ${slide.subtitle ? `<p class="lede">${esc(slide.subtitle)}</p>` : ''}
        <div class="steps">
          ${slide.nextSteps
            .map((step, i) => `<article class="step"><span class="num">${pad(i + 1)}</span><b>${esc(step.title)}</b><p>${esc(step.detail)}</p></article>`)
            .join('')}
        </div>`
  }
}

function coverSlide(slide: Extract<Slide, { layout: 'cover' }>, ctx: Ctx): string {
  const lockup = ctx.brand.logo
    ? `<img class="cover-logo" src="${ctx.brand.logo}" alt="${esc(ctx.input.company)}">`
    : `<b class="cover-name">${esc(ctx.input.company)}</b>`
  return `
    <section class="slide s-cover">
      <div class="cover-art" aria-hidden="true"><i class="blob"></i><i class="ring r1"></i><i class="ring r2"></i><i class="grid"></i></div>
      <header class="top">
        <div class="lockup">${lockup}<span class="x">×</span>${niraMark(26, 'var(--ink)')}</div>
        <div class="count"><b>${pad(ctx.index + 1)}</b> / ${pad(ctx.count)}</div>
      </header>
      <div class="content"><div class="fit">
        <p class="eyebrow">${esc(slide.kicker)}</p>
        <h1>${highlightTitle(slide.title, slide.highlight)}</h1>
        <p class="lede">${esc(slide.subtitle)}</p>
      </div></div>
      <footer class="cover-foot">
        ${statement(slide.statement)}
        <div class="meta">${esc(ctx.input.seller.name || 'Nira')} · ${esc(longDate())}</div>
      </footer>
    </section>`
}

function slideHtml(slide: Slide, ctx: Ctx): string {
  if (slide.layout === 'cover') return coverSlide(slide, ctx)
  const closingFoot =
    slide.layout === 'closing'
      ? `<div class="sign">${niraMark(22, 'var(--accent)')}<span>${esc(ctx.input.seller.name)}${ctx.input.seller.email ? ` · ${esc(ctx.input.seller.email)}` : ''}</span></div>`
      : ''
  return `
    <section class="slide s-${slide.layout}">
      ${['quote', 'closing', 'offer'].includes(slide.layout) ? '<div class="orb" aria-hidden="true"></div>' : ''}
      ${header(slide, ctx)}
      <div class="content"><div class="fit">${body(slide, ctx)}</div></div>
      ${statement(slide.statement)}
      ${closingFoot}
    </section>`
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#0d1117;font-family:var(--f-body);color:var(--ink);-webkit-font-smoothing:antialiased}
body{overflow:hidden}
.viewport{position:fixed;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--grad-a) 22%,#111) 0,#0b0e13 70%)}
.stage{position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;transform-origin:center;box-shadow:0 30px 120px rgba(0,0,0,.45)}
.slide{position:absolute;inset:0;display:none;flex-direction:column;padding:60px 96px 68px;overflow:hidden;
  background:radial-gradient(circle at 96% 0,color-mix(in srgb,var(--primary) 16%,transparent) 0,transparent 34%),linear-gradient(140deg,#fff 0%,var(--bg) 55%,var(--bg-2) 100%)}
.slide.active{display:flex;animation:in .5s cubic-bezier(.22,1,.36,1) both}
@keyframes in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:44px;position:relative;z-index:2;min-height:48px}
.brand{display:flex;align-items:center;gap:18px;flex:none}
.logo{height:42px;width:auto;max-width:200px;object-fit:contain;display:block}
.client-name{font:var(--hw) 22px var(--f-head);letter-spacing:-.02em}
.sep{width:1px;height:26px;background:var(--line)}
.kicker{font:600 14px var(--f-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent);white-space:nowrap}
.count{font:500 15px var(--f-mono);color:var(--muted)}.count b{color:var(--accent)}
.content{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:1}
.fit{transform-origin:left center}
h1,h2,h3{font-family:var(--f-head);font-weight:var(--hw);color:var(--ink);margin:0}
h1{font-size:104px;line-height:.98;letter-spacing:var(--tr);max-width:1180px;margin-bottom:34px}
h2{font-size:62px;line-height:1.04;letter-spacing:var(--tr);max-width:1150px;margin-bottom:44px}
h3{letter-spacing:-.03em}
.hl{background:linear-gradient(100deg,var(--grad-a),var(--grad-b));-webkit-background-clip:text;background-clip:text;color:transparent}
.lede{max-width:820px;font-size:25px;line-height:1.55;color:var(--muted);margin:0}
.eyebrow{font:600 15px var(--f-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 26px}
.statement{margin-top:34px;display:flex;gap:22px;align-items:center;font:700 29px/1.3 var(--f-head);letter-spacing:-.03em;max-width:1180px;position:relative;z-index:1;color:var(--ink)}
.statement:before{content:'';align-self:stretch;min-height:44px;width:6px;border-radius:6px;background:linear-gradient(var(--grad-b),var(--grad-a));flex:none}
.num{font:500 14px var(--f-mono);color:var(--accent);letter-spacing:.08em}
.card,.vcard,.node,.q,.result,.phase,.offer-item,.step,.bigstat{background:#fff;border:1px solid var(--line);box-shadow:0 18px 44px var(--shadow)}

/* couverture */
.s-cover{background:linear-gradient(135deg,#fff 0%,var(--bg) 60%,var(--bg-2) 100%)}
.cover-art{position:absolute;inset:0;pointer-events:none}
.cover-art .blob{position:absolute;width:760px;height:760px;right:-200px;top:-180px;border-radius:50%;background:radial-gradient(circle at 35% 35%,color-mix(in srgb,var(--grad-b) 55%,#fff),var(--grad-a) 70%);opacity:.9}
.cover-art .ring{position:absolute;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--primary) 30%,transparent)}
.cover-art .r1{width:980px;height:980px;right:-310px;top:-290px}.cover-art .r2{width:1220px;height:1220px;right:-430px;top:-410px;opacity:.6}
.cover-art .grid{position:absolute;left:0;bottom:0;width:55%;height:46%;opacity:.5;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:32px 32px;-webkit-mask-image:linear-gradient(to top right,#000,transparent 70%);mask-image:linear-gradient(to top right,#000,transparent 70%)}
.lockup{display:flex;align-items:center;gap:22px;padding:14px 26px;background:#fff;border-radius:18px;box-shadow:0 14px 34px var(--shadow)}
.cover-logo{height:60px;width:auto;max-width:280px;object-fit:contain;display:block}
.cover-name{font:var(--hw) 30px var(--f-head);letter-spacing:-.03em}
.x{font:300 26px var(--f-body);color:var(--muted)}
.s-cover h1{max-width:1020px}.s-cover .lede{max-width:760px}
.cover-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:40px;position:relative;z-index:1}
.cover-foot .statement{margin-top:0;max-width:900px}
.meta{font:500 14px var(--f-mono);color:var(--muted);white-space:nowrap}

/* compréhension */
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:72px;align-items:center}
.split h2{font-size:58px;margin-bottom:30px}
.numbered{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.numbered li{display:flex;gap:22px;align-items:center;padding:22px 26px;background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 14px 34px var(--shadow)}
.numbered li span{font:600 15px var(--f-mono);color:#fff;background:linear-gradient(135deg,var(--grad-a),var(--grad-b));width:44px;height:44px;border-radius:14px;display:grid;place-items:center;flex:none}
.numbered li p{margin:0;font-size:22px;font-weight:600;line-height:1.35;letter-spacing:-.01em}

/* citation */
.s-quote{background:linear-gradient(140deg,var(--bg) 0%,var(--soft) 100%)}
.quote{margin:0;max-width:1240px;position:relative}
.quote .mark{position:absolute;left:-18px;top:-120px;font:700 300px/1 Georgia,serif;color:var(--primary);opacity:.18}
.quote blockquote{margin:0;font:var(--hw) 64px/1.12 var(--f-head);letter-spacing:var(--tr);color:var(--ink)}
.quote figcaption{margin-top:34px;font:600 17px var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.quote .comment{margin:28px 0 0;max-width:860px;font-size:24px;line-height:1.5;color:var(--muted);padding-left:24px;border-left:3px solid var(--line)}
.orb{position:absolute;width:520px;height:520px;border-radius:50%;right:-160px;bottom:-220px;background:color-mix(in srgb,var(--primary) 14%,transparent)}

/* chiffre clé */
.statgrid{display:grid;grid-template-columns:1.15fr .85fr;gap:28px;align-items:stretch}
.bigstat{padding:46px 50px;border-radius:30px;display:flex;flex-direction:column;justify-content:flex-end}
.bigstat strong{display:block;font:var(--hw) 168px/.85 var(--f-head);letter-spacing:-.07em;background:linear-gradient(100deg,var(--grad-a),var(--grad-b));-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:8px}
.bigstat span{display:block;margin-top:26px;font:600 16px var(--f-mono);color:var(--accent);letter-spacing:.12em;text-transform:uppercase}
.bigstat small{color:var(--muted);font-size:20px;display:block;margin-top:10px;line-height:1.4}
.problem{display:grid;gap:14px;align-content:center}
.problem div{border-left:5px solid var(--primary);padding:22px 26px;background:rgba(255,255,255,.75);border-radius:0 18px 18px 0;font-size:22px;font-weight:700;letter-spacing:-.02em;line-height:1.3}
.problem div:nth-child(2){border-color:var(--accent-2)}.problem div:nth-child(3){border-color:var(--grad-a)}

/* cartes */
.cards{display:grid;gap:20px}
.cols-2{grid-template-columns:repeat(2,1fr)}.cols-3{grid-template-columns:repeat(3,1fr)}.cols-4{grid-template-columns:repeat(4,1fr)}
.pain{padding:32px 30px;border-radius:24px;min-height:270px;display:flex;flex-direction:column;position:relative}
.pain:before,.q:before{content:'';position:absolute;top:-1px;left:30px;width:56px;height:5px;border-radius:0 0 6px 6px;background:var(--primary)}
.pain:nth-child(even):before{background:var(--accent-2)}
.pain h3{font-size:28px;line-height:1.12;margin:26px 0 14px}
.pain p{margin:0;font-size:19px;line-height:1.5;color:var(--muted)}

/* avant / après */
.versus{display:grid;grid-template-columns:1fr 84px 1fr;gap:24px;align-items:center}
.vcard{border-radius:30px;padding:40px 42px;min-height:340px;display:flex;flex-direction:column;justify-content:space-between;gap:22px}
.vcard .label{font:600 15px var(--f-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.vcard strong{font:var(--hw) 84px/.9 var(--f-head);letter-spacing:-.06em}
.vcard p{margin:0;font-size:21px;line-height:1.5;color:var(--muted);max-width:520px}
.vcard.future{background:linear-gradient(145deg,var(--grad-a),var(--grad-b));border:0;color:#fff;box-shadow:0 28px 60px color-mix(in srgb,var(--grad-a) 35%,transparent)}
.vcard.future strong,.vcard.future .label,.vcard.future p{color:#fff}.vcard.future .label,.vcard.future p{opacity:.85}
.vs{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;background:var(--soft);color:var(--accent);font:600 18px var(--f-mono)}

/* flux */
.flow{display:flex;align-items:stretch;gap:14px}
.node{flex:1;min-height:260px;border-radius:26px;padding:30px 28px;display:flex;flex-direction:column;justify-content:flex-end;gap:8px}
.node .num{margin-bottom:auto}
.node b{font:var(--hw) 30px/1.1 var(--f-head);letter-spacing:-.035em}
.node span:last-child{font-size:18px;color:var(--muted);line-height:1.4}
.node.last{background:linear-gradient(145deg,var(--grad-a),var(--grad-b));color:#fff;border:0}
.node.last b,.node.last span,.node.last .num{color:#fff}.node.last span:last-child{opacity:.85}
.arrow{align-self:center;font-size:30px;color:var(--accent);flex:none}

/* piliers */
.pillars{display:grid;grid-template-columns:.9fr 1.1fr;gap:60px;align-items:center}
.pillars h2{font-size:56px;margin-bottom:26px}
.qualitymap{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.q{border-radius:24px;padding:30px;min-height:200px;position:relative}
.q strong{display:block;font:var(--hw) 25px/1.15 var(--f-head);letter-spacing:-.03em}
.q p{font-size:18px;line-height:1.5;color:var(--muted);margin:14px 0 0}
.q2:before{background:var(--accent-2)}.q3:before{background:var(--grad-b)}.q4:before{background:var(--grad-a)}

/* résultats */
.results{display:grid;gap:20px}
.result{padding:34px 30px;border-radius:26px;min-height:330px;display:flex;flex-direction:column;justify-content:space-between;gap:20px}
.result .value{font:var(--hw) 64px/1 var(--f-head);letter-spacing:-.05em;color:var(--accent)}
.result b{display:block;font:var(--hw) 26px/1.15 var(--f-head);letter-spacing:-.03em;margin-bottom:10px}
.result div span{font-size:18px;line-height:1.5;color:var(--muted)}
.result:nth-child(2){background:var(--soft)}.result:nth-child(3){background:var(--soft-2)}
.result:last-child{background:linear-gradient(145deg,var(--grad-a),var(--grad-b));border:0;color:#fff}
.result:last-child .value,.result:last-child b{color:#fff}.result:last-child div span{color:#fff;opacity:.85}

/* feuille de route */
.roadmap{display:grid}
.phase{padding:34px 32px;min-height:310px;position:relative;border-radius:0;box-shadow:none}
.phase:first-child{border-radius:26px 0 0 26px}.phase:last-child{border-radius:0 26px 26px 0}
.phase+.phase{border-left:0}
.phase:nth-child(even){background:var(--soft)}
.phase:after{content:'→';position:absolute;right:-21px;top:calc(50% - 21px);z-index:2;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--grad-a),var(--grad-b));color:#fff;font-size:20px}
.phase:last-child:after{display:none}
.phase-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.phase-no{font:600 14px var(--f-mono);color:var(--accent);letter-spacing:.1em}
.dur{font:500 13px var(--f-mono);color:var(--muted);background:var(--bg);border:1px solid var(--line);padding:6px 10px;border-radius:999px;white-space:nowrap}
.phase h3{font-size:36px;margin:34px 0 14px}
.phase p{font-size:19px;line-height:1.5;color:var(--muted);margin:0}

/* offre */
.offer{display:grid;grid-template-columns:1.08fr .92fr;gap:26px}
.offer-main{padding:44px;border-radius:32px;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(145deg,var(--grad-a),var(--grad-b));color:#fff;position:relative;overflow:hidden;box-shadow:0 30px 60px color-mix(in srgb,var(--grad-a) 32%,transparent)}
.offer-main>*{position:relative;z-index:1}
.offer-main:after{content:'';position:absolute;z-index:0;width:420px;height:420px;border-radius:50%;right:-140px;bottom:-200px;border:2px solid rgba(255,255,255,.18)}
.eyebrow-light{font:600 14px var(--f-mono);letter-spacing:.14em;text-transform:uppercase;opacity:.8}
.offer-main h3{color:#fff;font-size:50px;line-height:1.02;letter-spacing:var(--tr);margin:22px 0 18px;max-width:640px}
.offer-main p{font-size:21px;line-height:1.55;opacity:.88;max-width:600px;margin:0}
.price{margin-top:34px;display:flex;align-items:baseline;gap:12px}
.price strong{font:var(--hw) 76px/1 var(--f-head);letter-spacing:-.05em}
.price span{font:500 16px var(--f-mono);letter-spacing:.1em}
.offer-main small{display:block;margin-top:12px;font:500 14px var(--f-mono);opacity:.8;letter-spacing:.04em}
.offer-list{display:grid;gap:12px;align-content:center}
.offer-item{padding:20px 22px;border-radius:18px;display:flex;align-items:center;gap:16px;font-size:20px;font-weight:700;letter-spacing:-.015em;box-shadow:0 10px 26px var(--shadow)}
.offer-item:before{content:'✓';width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--soft);color:var(--accent);font-size:15px;flex:none}

/* conclusion */
.closing-title{font-size:78px;margin-bottom:24px}
.s-closing .lede{margin-bottom:44px}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.step{padding:30px;border-radius:24px}
.step b{display:block;font:var(--hw) 27px/1.15 var(--f-head);letter-spacing:-.03em;margin:18px 0 10px}
.step p{margin:0;font-size:18px;line-height:1.5;color:var(--muted)}
.sign{position:absolute;right:96px;bottom:68px;display:flex;align-items:center;gap:16px;font:500 15px var(--f-mono);color:var(--muted);z-index:2}
.s-closing .statement{max-width:900px}

/* commandes */
.controls{position:fixed;right:22px;bottom:22px;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:999px;background:rgba(15,20,28,.72);backdrop-filter:blur(10px);color:#fff;font:500 13px 'DM Mono',monospace;z-index:10;transition:opacity .4s}
.controls.idle{opacity:0}
.controls button{border:0;background:rgba(255,255,255,.1);color:#fff;height:36px;min-width:36px;padding:0 12px;border-radius:999px;cursor:pointer;font:inherit}
.controls button:hover{background:rgba(255,255,255,.22)}
.controls .pos{padding:0 8px;min-width:64px;text-align:center}
.bar{position:fixed;left:0;top:0;height:3px;background:linear-gradient(90deg,var(--grad-b),var(--grad-a));transition:width .35s;z-index:10}

.light-brand .hl{background:linear-gradient(transparent 58%,var(--primary) 58%,var(--primary) 90%,transparent 90%);-webkit-background-clip:border-box;background-clip:border-box;color:var(--ink)}
.light-brand .cover-art .blob{background:radial-gradient(circle at 35% 35%,color-mix(in srgb,var(--primary) 55%,#fff),var(--primary) 72%)}
.light-brand .cover-art .ring{border-color:color-mix(in srgb,var(--primary) 70%,transparent)}
.light-brand .statement:before,.light-brand .bar{background:var(--primary)}
.light-brand .numbered li span,.light-brand .phase:after,.light-brand .offer-item:before{background:var(--primary);color:var(--ink)}
.light-brand .offer-main .price strong,.light-brand .vcard.future strong,.light-brand .result:last-child .value,.light-brand .node.last .num{color:var(--primary)}
.light-brand .orb{background:color-mix(in srgb,var(--primary) 30%,transparent)}
@media print{
  @page{size:${W}px ${H}px;margin:0}
  html,body{height:auto;overflow:visible;background:#fff}
  .viewport{position:static;background:none}
  .stage{position:static;transform:none!important;box-shadow:none;height:auto}
  .slide{display:flex!important;position:relative;width:${W}px;height:${H}px;break-after:page;animation:none}
  .controls,.bar{display:none}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`

const SCRIPT = `
const stage = document.querySelector('.stage')
const slides = [...document.querySelectorAll('.slide')]
const pos = document.querySelector('.pos')
const bar = document.querySelector('.bar')
let current = 0

function fitStage() {
  const scale = Math.min(innerWidth / ${W}, innerHeight / ${H})
  stage.style.transform = 'translate(-50%,-50%) scale(' + scale + ')'
}

// Une slide trop chargée se réduit plutôt que de déborder.
function fitSlide(slide) {
  const box = slide.querySelector('.content')
  const fit = slide.querySelector('.fit')
  if (!box || !fit) return
  let zoom = 1
  fit.style.transform = ''
  fit.style.width = ''
  while (zoom > 0.66 && fit.scrollHeight * zoom > box.clientHeight + 1) {
    zoom -= 0.03
    fit.style.transform = 'scale(' + zoom + ')'
    fit.style.width = (100 / zoom) + '%'
  }
}

function fitAll() {
  slides.forEach((slide) => {
    const hidden = !slide.classList.contains('active')
    if (hidden) slide.style.display = 'flex'
    fitSlide(slide)
    if (hidden) slide.style.display = ''
  })
}

function show(index) {
  current = Math.max(0, Math.min(slides.length - 1, index))
  slides.forEach((slide, i) => slide.classList.toggle('active', i === current))
  pos.textContent = (current + 1) + ' / ' + slides.length
  bar.style.width = ((current + 1) / slides.length * 100) + '%'
  history.replaceState(null, '', '#' + (current + 1))
}

document.querySelector('#prev').onclick = () => show(current - 1)
document.querySelector('#next').onclick = () => show(current + 1)
document.querySelector('#full').onclick = () =>
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
document.querySelector('#pdf').onclick = () => window.print()
addEventListener('keydown', (event) => {
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); show(current + 1) }
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); show(current - 1) }
  if (event.key === 'Home') show(0)
  if (event.key === 'End') show(slides.length - 1)
  if (event.key === 'f') document.querySelector('#full').click()
})
document.querySelector('.viewport').addEventListener('click', (event) => {
  if (event.target.closest('.controls')) return
  show(current + (event.clientX > innerWidth / 3 ? 1 : -1))
})

const controls = document.querySelector('.controls')
let idle
addEventListener('mousemove', () => {
  controls.classList.remove('idle')
  clearTimeout(idle)
  idle = setTimeout(() => controls.classList.add('idle'), 2500)
})

addEventListener('resize', fitStage)
fitStage()
const start = parseInt(location.hash.slice(1), 10)
show(Number.isFinite(start) ? start - 1 : 0)
const ready = document.fonts ? document.fonts.ready : Promise.resolve()
ready.then(() => {
  fitAll()
  if (location.hash === '#print') setTimeout(() => window.print(), 400)
})
addEventListener('beforeprint', fitAll)`

export function renderDeck(content: GeneratedContent, brand: Brand, input: StudioInput): string {
  const palette = paletteOf(brand)
  const fonts = fontsOf(content.brief.typography)
  const { total } = pricingOf(content.brief, input)
  const slides = content.deck.slides
  const html = slides
    .map((slide, index) => slideHtml(slide, { brand, input, content, total, index, count: slides.length }))
    .join('')

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(input.company)} — ${esc(content.brief.projectTitle)}</title>
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
<div class="bar"></div>
<main class="viewport"><div class="stage">${html}</div></main>
<nav class="controls idle">
  <button id="prev" aria-label="Slide précédente">←</button>
  <span class="pos"></span>
  <button id="next" aria-label="Slide suivante">→</button>
  <button id="full" title="Plein écran (F)">⛶</button>
  <button id="pdf" title="Exporter en PDF">PDF</button>
</nav>
<script>${SCRIPT}</script>
</body>
</html>`
}
