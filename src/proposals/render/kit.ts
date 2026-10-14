/**
 * Bibliothèque de composants des présentations libres.
 *
 * Le modèle compose ses slides sans les voir : lui confier des coordonnées de
 * traits ou de cadres produit des schémas de travers. Il assemble donc des
 * composants dont la finition est garantie ici (flux, frises, étoile, matrice,
 * barres, chiffres, citations…) et ne garde la main que sur la structure, le
 * contenu et quelques ajustements. Toute la charte vient des variables du client.
 */

export const KIT_CSS = `
:root{--ink-0:var(--ink);--muted-0:var(--muted);--accent-0:var(--accent);--line-0:var(--line)}
/* Sur fond sombre ou coloré, les couleurs de texte basculent d'elles-mêmes ;
   les surfaces blanches posées dessus retrouvent les couleurs d'origine. */
.k-bg-brand,.k-bg-dark{--ink:#fff;--muted:rgba(255,255,255,.74);--accent:#fff;--line:rgba(255,255,255,.22)}
:is(.k-bg-brand,.k-bg-dark) :is(.k-step:not(.is-highlight):not(.is-pain),.k-hub-item,.k-panel:not(.is-brand),.k-vs,.k-logo,.k-matrix){--ink:var(--ink-0);--muted:var(--muted-0);--accent:var(--accent-0);--line:var(--line-0);color:var(--ink-0)}
.k-slide{position:absolute;inset:0;padding:96px 112px 92px;display:flex;flex-direction:column;gap:40px;overflow:hidden;background:var(--bg);color:var(--ink)}
.k-slide>*{position:relative;z-index:1}
.k-fill{flex:1;min-height:0}
.k-center{justify-content:center}
.k-end{justify-content:flex-end}
.k-between{justify-content:space-between}
.k-row{display:flex;align-items:center;gap:32px}
.k-row.is-between{justify-content:space-between}
.k-stack{display:flex;flex-direction:column;gap:24px}
.k-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.k-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.k-split{display:grid;grid-template-columns:5fr 7fr;gap:72px;align-items:center}
.k-split.is-reverse{grid-template-columns:7fr 5fr}

/* fonds */
.k-bg-light{background:#fff}
.k-bg-tint{background:linear-gradient(160deg,var(--bg) 0%,var(--bg-2) 100%)}
.k-bg-soft{background:var(--soft)}
.k-bg-brand{background:linear-gradient(135deg,var(--grad-a),var(--grad-b));color:#fff}
.k-bg-dark{background:radial-gradient(circle at 85% 15%,color-mix(in srgb,var(--grad-b) 35%,transparent),transparent 45%),color-mix(in srgb,var(--ink-0) 92%,#000);color:#fff}
.k-bg-brand :is(h1,h2,h3,.k-h-xl,.k-h-l,.k-h-m,.k-h-s),.k-bg-dark :is(h1,h2,h3,.k-h-xl,.k-h-l,.k-h-m,.k-h-s){color:#fff}
.k-bg-brand .k-lede,.k-bg-dark .k-lede,.k-bg-brand .k-body,.k-bg-dark .k-body{color:rgba(255,255,255,.78)}
.k-bg-brand .k-eyebrow,.k-bg-dark .k-eyebrow{color:rgba(255,255,255,.75)}
.k-bg-brand .k-eyebrow:before,.k-bg-dark .k-eyebrow:before{background:currentColor}

/* typographie */
.k-eyebrow{display:flex;align-items:center;gap:16px;font:500 16px var(--f-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
.k-eyebrow:before{content:'';width:40px;height:2px;background:var(--primary)}
.k-h-xl{font:var(--hw) 144px/.92 var(--f-head);letter-spacing:var(--tr)}
.k-h-l{font:var(--hw) 100px/.98 var(--f-head);letter-spacing:var(--tr)}
.k-h-m{font:var(--hw) 68px/1.04 var(--f-head);letter-spacing:var(--tr)}
.k-h-s{font:var(--hw) 40px/1.12 var(--f-head);letter-spacing:-.02em}
:is(.k-h-xl,.k-h-l,.k-h-m,.k-h-s)+:is(.k-lede,.k-body,p){margin-top:28px}
:is(.k-eyebrow,.k-chapter,.k-tag)+:is(.k-h-xl,.k-h-l,.k-h-m,.k-h-s,h1,h2){margin-top:24px}
.k-lede{font-size:30px;line-height:1.45;color:var(--muted);max-width:900px}
.k-body{font-size:23px;line-height:1.55;color:var(--muted)}
.k-mono{font:500 18px var(--f-mono);letter-spacing:.06em;color:var(--muted)}
.k-accent{color:var(--accent)}
.k-mark{background:linear-gradient(transparent 60%,color-mix(in srgb,var(--primary) 45%,transparent) 60%,color-mix(in srgb,var(--primary) 45%,transparent) 92%,transparent 92%);padding:0 .06em}
.k-grad-text{background:linear-gradient(100deg,var(--grad-a),var(--grad-b));-webkit-background-clip:text;background-clip:text;color:transparent}
.k-bg-brand .k-grad-text,.k-bg-dark .k-grad-text{background:none;color:#fff}
.k-chapter{font:500 18px var(--f-mono);letter-spacing:.12em;color:var(--muted)}
.k-chapter b{font:var(--hw) 22px var(--f-head);color:var(--accent);margin-right:12px;letter-spacing:0}

/* logo */
.k-logo{display:inline-flex;align-items:center;padding:16px 26px;border-radius:18px;background:#fff;box-shadow:0 14px 36px var(--shadow)}
.k-logo .client-logo,.client-logo{height:52px;width:auto;max-width:280px;object-fit:contain;display:block}
.k-logo.is-small{padding:10px 16px;border-radius:12px}.k-logo.is-small .client-logo{height:34px}
.k-logo.is-large .client-logo{height:84px;max-width:420px}
.k-cobrand{display:flex;align-items:center;gap:22px}
.k-cobrand .k-x{font:300 30px var(--f-body);opacity:.6}
.k-nira{font:800 30px/1 Manrope,Arial,sans-serif;letter-spacing:-.04em}

/* grands chiffres */
.k-stat b{display:block;white-space:nowrap;font:var(--hw) 200px/.82 var(--f-head);letter-spacing:-.06em;color:var(--accent)}
.k-stat.is-xl b{font-size:300px}
.k-stat.is-m b{font-size:120px}
.k-stat span{display:block;margin-top:22px;font:500 18px var(--f-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.k-stat small{display:block;margin-top:10px;font-size:22px;line-height:1.45;color:var(--muted);max-width:520px}
.k-bg-brand .k-stat b,.k-bg-dark .k-stat b,.k-bg-brand .k-stat span,.k-bg-dark .k-stat span{color:#fff}
.k-bg-brand .k-stat small,.k-bg-dark .k-stat small{color:rgba(255,255,255,.75)}
.k-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:48px}
.k-stats .k-stat b{font-size:92px}
.k-stats>.k-stat{padding-top:28px;border-top:2px solid var(--line)}
.k-bg-brand .k-stats>.k-stat,.k-bg-dark .k-stats>.k-stat{border-color:rgba(255,255,255,.25)}

/* citation */
.k-quote{max-width:1240px}
.k-quote blockquote{margin:0;font:var(--hw) 76px/1.08 var(--f-head);letter-spacing:var(--tr);position:relative}
.k-quote blockquote:before{content:'“';position:absolute;left:-.55em;top:-.12em;font:700 1.9em/1 Georgia,serif;color:var(--primary);opacity:.35}
.k-quote cite{display:block;margin-top:40px;font:500 18px var(--f-mono);font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.k-quote.is-m blockquote{font-size:56px}
.k-bg-brand .k-quote cite,.k-bg-dark .k-quote cite{color:rgba(255,255,255,.8)}
.k-bg-brand .k-quote blockquote:before,.k-bg-dark .k-quote blockquote:before{color:#fff}

/* cartes */
.k-cards{display:grid;grid-template-columns:repeat(var(--cols,3),1fr);gap:24px}
.k-card{position:relative;padding:36px 34px;border-radius:26px;background:#fff;border:1px solid var(--line);box-shadow:0 20px 50px var(--shadow);display:flex;flex-direction:column;gap:14px;min-height:240px}
.k-card h3{font:var(--hw) 32px/1.12 var(--f-head);letter-spacing:-.025em}
.k-card p{font-size:21px;line-height:1.5;color:var(--muted)}
.k-card .k-num{font:500 16px var(--f-mono);color:var(--accent);letter-spacing:.1em;margin-bottom:auto;padding-bottom:28px}
.k-card.is-brand{background:linear-gradient(145deg,var(--grad-a),var(--grad-b));border:0;color:#fff}
.k-card.is-dark{background:color-mix(in srgb,var(--ink-0) 92%,#000);border:0;color:#fff}
.k-card.is-brand :is(h3,.k-num),.k-card.is-dark :is(h3,.k-num){color:#fff}
.k-card.is-brand p,.k-card.is-dark p{color:rgba(255,255,255,.8)}
.k-card.is-soft{background:var(--soft);box-shadow:none;border-color:transparent}
.k-card.is-outline{background:transparent;box-shadow:none;border:2px solid var(--line)}
.k-card.is-ghost{background:transparent;border:0;box-shadow:none;padding:0;min-height:0}
.k-bg-brand .k-card:not(.is-brand):not(.is-dark),.k-bg-dark .k-card:not(.is-brand):not(.is-dark){background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);box-shadow:none;color:#fff;backdrop-filter:blur(4px)}
.k-bg-brand .k-card:not(.is-brand) :is(h3,.k-num),.k-bg-dark .k-card:not(.is-dark) :is(h3,.k-num){color:#fff}
.k-bg-brand .k-card:not(.is-brand) p,.k-bg-dark .k-card:not(.is-dark) p{color:rgba(255,255,255,.75)}
.k-icon{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:var(--soft);color:var(--accent)}
.k-icon svg{width:32px;height:32px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.k-card.is-brand .k-icon,.k-card.is-dark .k-icon{background:rgba(255,255,255,.14);color:#fff}

/* flux */
.k-flow{display:flex;align-items:stretch;gap:0}
.k-step{flex:1;position:relative;padding:34px 30px 32px;background:#fff;border:1px solid var(--line);border-radius:24px;display:flex;flex-direction:column;gap:12px;min-height:230px;box-shadow:0 16px 40px var(--shadow)}
.k-step+.k-step{margin-left:56px}
.k-step+.k-step:before{content:'';position:absolute;left:-46px;top:50%;width:36px;height:2px;background:var(--accent)}
.k-step+.k-step:after{content:'';position:absolute;left:-16px;top:calc(50% - 6px);border:7px solid transparent;border-left:9px solid var(--accent)}
.k-step .k-num{font:500 15px var(--f-mono);color:var(--accent);letter-spacing:.1em;margin-bottom:auto}
.k-step h3{font:var(--hw) 30px/1.1 var(--f-head);letter-spacing:-.025em}
.k-step p{font-size:19px;line-height:1.45;color:var(--muted)}
.k-step.is-highlight{background:linear-gradient(145deg,var(--grad-a),var(--grad-b));border:0;color:#fff}
.k-step.is-highlight :is(h3,.k-num){color:#fff}.k-step.is-highlight p{color:rgba(255,255,255,.82)}
.k-step.is-pain{border:2px dashed color-mix(in srgb,var(--accent) 60%,transparent);box-shadow:none;background:transparent}
.k-flow.is-vertical{flex-direction:column}
.k-flow.is-vertical .k-step{min-height:0}
.k-flow.is-vertical .k-step+.k-step{margin:44px 0 0}
.k-flow.is-vertical .k-step+.k-step:before{left:50%;top:-36px;width:2px;height:28px}
.k-flow.is-vertical .k-step+.k-step:after{left:calc(50% - 6px);top:-14px;border:7px solid transparent;border-top:9px solid var(--accent)}

/* frise */
.k-timeline{display:grid;grid-template-columns:repeat(var(--n,4),1fr);gap:28px;position:relative;padding-top:56px}
.k-timeline:before{content:'';position:absolute;left:0;right:0;top:15px;height:2px;background:linear-gradient(90deg,var(--grad-a),var(--grad-b))}
.k-phase{position:relative;display:flex;flex-direction:column;gap:12px}
.k-phase:before{content:'';position:absolute;left:0;top:-52px;width:28px;height:28px;border-radius:50%;background:#fff;border:6px solid var(--accent);box-sizing:border-box}
.k-phase.is-active:before{background:var(--accent)}
.k-phase .k-when{font:500 16px var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.k-phase h3{font:var(--hw) 36px/1.08 var(--f-head);letter-spacing:-.03em}
.k-phase p{font-size:20px;line-height:1.5;color:var(--muted)}
.k-bg-brand .k-phase :is(h3,.k-when),.k-bg-dark .k-phase :is(h3,.k-when){color:#fff}
.k-bg-brand .k-phase p,.k-bg-dark .k-phase p{color:rgba(255,255,255,.75)}
.k-bg-brand .k-timeline:before,.k-bg-dark .k-timeline:before{background:rgba(255,255,255,.4)}

/* étoile : un centre et ses satellites */
.k-hub{position:relative;width:820px;height:600px;margin:0 auto}
.k-hub-core{position:absolute;left:50%;top:50%;width:230px;height:230px;margin:-115px 0 0 -115px;border-radius:50%;display:grid;place-items:center;text-align:center;padding:28px;background:linear-gradient(145deg,var(--grad-a),var(--grad-b));color:#fff;font:var(--hw) 28px/1.15 var(--f-head);box-shadow:0 24px 60px color-mix(in srgb,var(--grad-a) 35%,transparent);z-index:2}
.k-hub-item{--a:calc(var(--i) * 360deg / var(--n) - 90deg);position:absolute;left:50%;top:50%;width:250px;margin-left:-125px;transform:translate(calc(cos(var(--a)) * 300px),calc(sin(var(--a)) * 235px - 50%));padding:20px 22px;border-radius:20px;background:#fff;border:1px solid var(--line);box-shadow:0 14px 36px var(--shadow);text-align:center;z-index:2}
.k-hub-item b{display:block;font:var(--hw) 24px/1.15 var(--f-head);letter-spacing:-.02em}
.k-hub-item span{display:block;margin-top:6px;font-size:17px;line-height:1.4;color:var(--muted)}
.k-hub-item.is-highlight{border:2px solid var(--accent)}
.k-hub:before{content:'';position:absolute;left:50%;top:50%;width:600px;height:470px;margin:-235px 0 0 -300px;border-radius:50%;border:2px dashed color-mix(in srgb,var(--accent) 35%,transparent);z-index:1}

/* barres */
.k-bars{display:flex;flex-direction:column;gap:26px}
.k-bar{display:grid;grid-template-columns:300px 1fr 150px;align-items:center;gap:24px;font-size:21px}
.k-bar>span:first-child{color:var(--ink);font-weight:600}
.k-bar i{display:block;height:22px;border-radius:12px;background:var(--soft);position:relative;overflow:hidden}
.k-bar i:after{content:'';position:absolute;inset:0;width:calc(var(--v) * 1%);border-radius:12px;background:linear-gradient(90deg,var(--grad-a),var(--grad-b))}
.k-bar.is-muted i:after{background:color-mix(in srgb,var(--muted) 45%,transparent)}
.k-bar b{font:var(--hw) 30px var(--f-head);color:var(--accent);text-align:right}

/* avant / après */
.k-versus{display:grid;grid-template-columns:1fr 96px 1fr;align-items:stretch}
.k-versus>div{padding:48px;border-radius:30px;display:flex;flex-direction:column;gap:18px}
.k-versus .is-before{background:transparent;border:2px dashed var(--line)}
.k-versus .is-after{background:linear-gradient(145deg,var(--grad-a),var(--grad-b));color:#fff;box-shadow:0 30px 60px color-mix(in srgb,var(--grad-a) 30%,transparent)}
.k-versus .k-vs{align-self:center;justify-self:center;width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:#fff;border:1px solid var(--line);font:500 16px var(--f-mono);color:var(--accent);padding:0}
.k-versus h3{font:var(--hw) 56px/1 var(--f-head);letter-spacing:-.04em}
.k-versus .k-mono{text-transform:uppercase;letter-spacing:.14em}
.k-versus .is-after .k-mono,.k-versus .is-after p{color:rgba(255,255,255,.82)}
.k-versus p{font-size:22px;line-height:1.5;color:var(--muted)}
.k-versus ul{margin:0;padding:0;list-style:none;display:grid;gap:12px;font-size:21px}
.k-versus li{display:flex;gap:12px}.k-versus li:before{content:'—';opacity:.5}

/* matrice impact / effort */
.k-matrix{position:relative;width:760px;height:600px;border-left:2px solid var(--ink-0);border-bottom:2px solid var(--ink-0);background:linear-gradient(var(--line) 1px,transparent 1px) 0 0/100% 50%,linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/50% 100%}
.k-matrix .k-q{position:absolute;font:500 14px var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.k-matrix .k-q.is-tl{left:20px;top:16px}.k-matrix .k-q.is-tr{right:20px;top:16px;color:var(--accent)}.k-matrix .k-q.is-bl{left:20px;bottom:16px}.k-matrix .k-q.is-br{right:20px;bottom:16px}
.k-matrix .k-axis-x{position:absolute;bottom:-42px;left:0;right:0;text-align:center;font:500 15px var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.k-matrix .k-axis-y{position:absolute;left:-46px;top:50%;transform:translate(-50%,-50%) rotate(-90deg);white-space:nowrap;font:500 15px var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.k-dot{position:absolute;left:calc(var(--x) * 1%);bottom:calc(var(--y) * 1%);transform:translate(-50%,50%);display:flex;align-items:center;gap:12px;white-space:nowrap;font-size:19px;font-weight:600}
.k-dot:before{content:'';width:22px;height:22px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 6px color-mix(in srgb,var(--accent) 18%,transparent);flex:none}
.k-dot.is-muted:before{background:var(--muted)}

/* listes */
.k-checks{margin:0;padding:0;list-style:none;display:grid;gap:18px}
.k-checks li{display:flex;align-items:flex-start;gap:18px;font-size:24px;line-height:1.4;font-weight:600}
.k-checks li:before{content:'';flex:none;width:34px;height:34px;border-radius:50%;background:var(--accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") no-repeat center/18px}
.k-checks.is-cols{grid-template-columns:1fr 1fr;column-gap:48px}
.k-bg-brand .k-checks li:before,.k-bg-dark .k-checks li:before{background-color:rgba(255,255,255,.22)}
.light-brand .k-checks li:before{background-color:var(--ink-0)}
.k-numbers{margin:0;padding:0;list-style:none;counter-reset:k;display:grid;gap:0}
.k-numbers li{counter-increment:k;display:grid;grid-template-columns:90px 1fr;gap:24px;padding:26px 0;border-top:1px solid var(--line);font-size:24px;line-height:1.45}
.k-numbers li:last-child{border-bottom:1px solid var(--line)}
.k-numbers li:before{content:counter(k,decimal-leading-zero);font:var(--hw) 34px var(--f-head);color:var(--accent)}
.k-numbers li b{display:block;font:var(--hw) 30px/1.2 var(--f-head);letter-spacing:-.02em;margin-bottom:6px}
.k-numbers li span{color:var(--muted);font-size:21px}
.k-bg-brand .k-numbers li,.k-bg-dark .k-numbers li{border-color:rgba(255,255,255,.2)}
.k-bg-brand .k-numbers li:before,.k-bg-dark .k-numbers li:before{color:#fff}
.k-bg-brand .k-numbers li span,.k-bg-dark .k-numbers li span{color:rgba(255,255,255,.75)}

/* prix */
.k-price{display:flex;align-items:baseline;gap:16px}
.k-price{flex-wrap:wrap}
.k-price b{white-space:nowrap;font:var(--hw) 120px/1 var(--f-head);letter-spacing:-.05em}
.k-price span{font:500 18px var(--f-mono);letter-spacing:.12em;text-transform:uppercase;opacity:.8}

/* formes décoratives */
.k-deco{position:absolute;pointer-events:none;z-index:0}
.k-circle{border-radius:50%;background:radial-gradient(circle at 30% 30%,color-mix(in srgb,var(--grad-b) 60%,#fff),var(--grad-a) 75%)}
.k-ring{border-radius:50%;border:2px solid color-mix(in srgb,var(--primary) 35%,transparent)}
.k-dots{background-image:radial-gradient(color-mix(in srgb,var(--accent) 35%,transparent) 2px,transparent 2.5px);background-size:28px 28px}
.k-lines{background-image:repeating-linear-gradient(135deg,color-mix(in srgb,var(--primary) 18%,transparent) 0 2px,transparent 2px 22px)}
.k-bg-brand .k-ring,.k-bg-dark .k-ring{border-color:rgba(255,255,255,.2)}
.k-bg-brand .k-dots,.k-bg-dark .k-dots{background-image:radial-gradient(rgba(255,255,255,.25) 2px,transparent 2.5px)}
.k-tr{right:-180px;top:-180px}.k-br{right:-160px;bottom:-200px}.k-tl{left:-180px;top:-180px}.k-bl{left:-160px;bottom:-200px}
.k-w-s{width:320px;height:320px}.k-w-m{width:560px;height:560px}.k-w-l{width:820px;height:820px}

/* repères */
.k-tag{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;background:var(--soft);color:var(--accent);font:500 15px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;width:fit-content}
.k-bg-brand .k-tag,.k-bg-dark .k-tag{background:rgba(255,255,255,.14);color:#fff}
.k-divider{height:2px;background:var(--line);border:0;margin:0}
.k-panel{padding:48px;border-radius:32px;background:#fff;border:1px solid var(--line);box-shadow:0 24px 60px var(--shadow)}
.k-panel.is-brand{background:linear-gradient(145deg,var(--grad-a),var(--grad-b));color:#fff;border:0}
.k-panel.is-brand :is(h2,h3,.k-h-m,.k-h-s){color:#fff}
.k-panel.is-brand p,.k-panel.is-brand .k-body{color:rgba(255,255,255,.82)}

/* marques claires */
.light-brand .k-bg-brand,.light-brand .k-card.is-brand,.light-brand .k-step.is-highlight,.light-brand .k-versus .is-after,.light-brand .k-panel.is-brand,.light-brand .k-hub-core{background:var(--primary);--ink:var(--ink-0);--muted:color-mix(in srgb,var(--ink-0) 75%,transparent);--accent:var(--ink-0);--line:color-mix(in srgb,var(--ink-0) 20%,transparent);color:var(--ink-0)}
.light-brand .k-bg-brand *,.light-brand .k-card.is-brand *,.light-brand .k-step.is-highlight *,.light-brand .k-versus .is-after *,.light-brand .k-panel.is-brand *{color:var(--ink)!important}
.light-brand .k-mark{background:linear-gradient(transparent 58%,var(--primary) 58%,var(--primary) 92%,transparent 92%)}
.light-brand .k-timeline:before,.light-brand .k-bar i:after{background:var(--primary)}
`
