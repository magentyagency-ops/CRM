import type { Brand, Typography } from './model.js'

/**
 * Charte graphique d'un document, dérivée des deux couleurs du client.
 *
 * Les couleurs d'un logo ne sont pas faites pour du texte : un jaune ou un
 * turquoise clair deviendraient illisibles sur fond blanc. Chaque teinte est
 * donc assombrie jusqu'à un contraste suffisant, en gardant sa couleur.
 */

type Rgb = [number, number, number]
type Hsl = [number, number, number]

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const raw = match[1].length === 3 ? [...match[1]].map((char) => char + char).join('') : match[1]
  return [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16)) as Rgb
}

export const toHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`

export function rgbToHsl([r, g, b]: Rgb): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h * 60, s, l]
}

export function hslToRgb([h, s, l]: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360 / 360
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [channel(hue + 1 / 3) * 255, channel(hue) * 255, channel(hue - 1 / 3) * 255]
}

const hsl = (h: number, s: number, l: number): string => toHex(hslToRgb([h, clamp(s), clamp(l)]))

function luminance([r, g, b]: Rgb): number {
  const lin = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export const contrast = (a: Rgb, b: Rgb): number => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Assombrit une teinte jusqu'au contraste demandé sur fond blanc. */
function readableOnWhite(color: Hsl, ratio: number): Hsl {
  let [h, s, l] = color
  while (l > 0.08 && contrast(hslToRgb([h, s, l]), [255, 255, 255]) < ratio) l -= 0.02
  return [h, s, l]
}

export interface Palette {
  primary: string
  accent: string
  accent2: string
  gradA: string
  gradB: string
  ink: string
  muted: string
  line: string
  bg: string
  bg2: string
  soft: string
  soft2: string
  shadow: string
  /** Marque trop claire pour du texte : traitement « surligneur » dans les gabarits. */
  lightBrand: boolean
}

const DEFAULT_PRIMARY = '#1976d2'

export function paletteOf(brand: Pick<Brand, 'primary' | 'secondary'>): Palette {
  const primaryRgb = parseHex(brand.primary) ?? parseHex(DEFAULT_PRIMARY)!
  let [h, s, l] = rgbToHsl(primaryRgb)
  // Un logo noir ou gris ne donne pas de teinte : on garde une teinte sobre.
  const neutral = s < 0.12
  if (neutral) s = 0.08
  if (l > 0.9) l = 0.55

  const secondaryRgb = parseHex(brand.secondary)
  let second: Hsl = secondaryRgb ? rgbToHsl(secondaryRgb) : [h + 32, s, l]
  // Un secondaire gris ou trop proche du principal n'apporterait rien.
  if (second[1] < 0.12 || Math.abs(((second[0] - h + 540) % 360) - 180) < 12) second = [h + 32, Math.max(s, 0.45), l]

  const accent = readableOnWhite([h, s, l], 4.6)
  // Une marque très claire (jaune, citron, pastel) perdrait son éclat une fois
  // assombrie : ses grands aplats passent en sombre et la couleur reste pure en accent.
  const lightBrand = !neutral && contrast(hslToRgb([h, s, l]), [255, 255, 255]) < 2.2
  const gradA: Hsl = lightBrand ? [h, Math.min(s, 0.3), 0.13] : readableOnWhite([h, Math.min(1, s * 1.05), l], 5.2)
  const gradB: Hsl = lightBrand
    ? [h, Math.min(s, 0.35), 0.24]
    : readableOnWhite([h - 14, Math.min(1, s * 1.1), Math.min(0.62, l + 0.1)], 3.4)
  const accent2 = readableOnWhite(second, 3.2)
  const tint = neutral ? 0.06 : Math.min(s, 0.55)

  return {
    primary: toHex(hslToRgb([h, s, l])),
    accent: hsl(...accent),
    accent2: hsl(...accent2),
    gradA: hsl(...gradA),
    gradB: hsl(...gradB),
    ink: hsl(h, Math.min(s, 0.42), 0.14),
    muted: hsl(h, Math.min(s, 0.16), 0.42),
    line: hsl(h, Math.min(s, 0.32), 0.9),
    bg: hsl(h, tint, 0.975),
    bg2: hsl(h, tint * 0.9, 0.94),
    soft: hsl(h, Math.min(1, tint * 1.3), 0.95),
    soft2: hsl(second[0], Math.min(second[1], 0.5), 0.95),
    shadow: `${hsl(h, Math.min(s, 0.5), 0.3)}1f`,
    lightBrand,
  }
}

export const paletteCss = (palette: Palette): string =>
  Object.entries(palette)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `--${key.replace(/[A-Z0-9]/g, (char) => `-${char.toLowerCase()}`)}:${value}`)
    .join(';')

/* ------------------------------------------------------------ typographie */

interface Fonts {
  head: string
  body: string
  mono: string
  /** Graisse des titres : un empattement se lit mieux moins gras. */
  headWeight: number
  tracking: string
  href: string
}

const google = (families: string) => `https://fonts.googleapis.com/css2?${families}&display=swap`

export const FONTS: Record<Typography, Fonts> = {
  moderne: {
    head: "'Manrope', Arial, sans-serif",
    body: "'Manrope', Arial, sans-serif",
    mono: "'DM Mono', monospace",
    headWeight: 800,
    tracking: '-0.055em',
    href: google('family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800'),
  },
  editorial: {
    head: "'Fraunces', Georgia, serif",
    body: "'Inter', Arial, sans-serif",
    mono: "'DM Mono', monospace",
    headWeight: 600,
    tracking: '-0.035em',
    href: google('family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700'),
  },
  tech: {
    head: "'Space Grotesk', Arial, sans-serif",
    body: "'Inter', Arial, sans-serif",
    mono: "'JetBrains Mono', monospace",
    headWeight: 700,
    tracking: '-0.045em',
    href: google('family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700'),
  },
  classique: {
    head: "'Playfair Display', Georgia, serif",
    body: "'Source Sans 3', Arial, sans-serif",
    mono: "'IBM Plex Mono', monospace",
    headWeight: 600,
    tracking: '-0.025em',
    href: google('family=IBM+Plex+Mono:wght@400;500&family=Playfair+Display:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700'),
  },
}

export const fontsOf = (typography: Typography): Fonts => FONTS[typography] ?? FONTS.moderne

/* ------------------------------------------------------------ utilitaires */

export const esc = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  )

/** Texte échappé, les retours à la ligne voulus devenant des <br>. */
export const lines = (value: string): string => esc(value).replace(/\\n|\n/g, '<br>')

export const money = (value: number): string =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value || 0).replace(/ /g, ' ')} €`

export const longDate = (date: Date = new Date()): string =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Mot-symbole Nira, en texte pour rester net à toutes les tailles. */
export const niraMark = (size = 22, color = 'currentColor'): string =>
  `<span class="nira-mark" style="font:800 ${size}px/1 Manrope,Arial,sans-serif;letter-spacing:-.04em;color:${color}">NIRA</span>`
