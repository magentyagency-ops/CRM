import { rgbToHsl, toHex } from './theme.js'

/**
 * Préparation du logo client : il est rogné de ses marges vides, redimensionné
 * en PNG (un logo de 5 Mo alourdirait chaque document), et ses deux couleurs
 * dominantes sont proposées comme charte.
 */

export interface LogoResult {
  dataUrl: string
  primary: string
  secondary: string
}

const MAX_SIDE = 900

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image illisible : essaie un PNG, un JPG ou un SVG.'))
    image.src = url
  })
}

/** Pixel « vide » : transparent ou quasi blanc. */
const isBlank = (data: Uint8ClampedArray, i: number) =>
  data[i + 3] < 24 || (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244)

function trimBounds(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = ctx.getImageData(0, 0, width, height)
  let top = height
  let left = width
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBlank(data, (y * width + x) * 4)) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return { x: 0, y: 0, w: width, h: height }
  const margin = Math.round(Math.max(width, height) * 0.01)
  const x = Math.max(0, left - margin)
  const y = Math.max(0, top - margin)
  return { x, y, w: Math.min(width, right + margin + 1) - x, h: Math.min(height, bottom + margin + 1) - y }
}

function dominantColors(ctx: CanvasRenderingContext2D, width: number, height: number): [string, string] {
  const { data } = ctx.getImageData(0, 0, width, height)
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number; hue: number }>()
  let dark = { weight: 0, r: 0, g: 0, b: 0 }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]]
    const [h, s, l] = rgbToHsl(rgb)
    if (l > 0.93) continue
    if (s < 0.18 || l < 0.1) {
      // Texte noir ou gris foncé : utile seulement si le logo n'a aucune couleur.
      if (l < 0.35) dark = { weight: dark.weight + 1, r: dark.r + rgb[0], g: dark.g + rgb[1], b: dark.b + rgb[2] }
      continue
    }
    const key = Math.round(h / 15) % 24
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0, hue: h }
    const weight = s * (1 - Math.abs(l - 0.5))
    bucket.weight += weight
    bucket.r += rgb[0] * weight
    bucket.g += rgb[1] * weight
    bucket.b += rgb[2] * weight
    buckets.set(key, bucket)
  }

  const ranked = [...buckets.values()].sort((a, b) => b.weight - a.weight)
  const color = (bucket: { weight: number; r: number; g: number; b: number }) =>
    toHex([bucket.r / bucket.weight, bucket.g / bucket.weight, bucket.b / bucket.weight])
  const darkColor = dark.weight ? toHex([dark.r / dark.weight, dark.g / dark.weight, dark.b / dark.weight]) : '#1f2937'

  if (!ranked.length) return [darkColor, '']
  const first = ranked[0]
  const second = ranked.find((bucket) => {
    const distance = Math.abs(((bucket.hue - first.hue + 540) % 360) - 180)
    return distance >= 30 && bucket.weight > first.weight * 0.08
  })
  return [color(first), second ? color(second) : dark.weight ? darkColor : '']
}

export async function prepareLogo(file: File): Promise<LogoResult> {
  if (file.size > 15 * 1024 * 1024) throw new Error('Logo trop lourd (15 Mo maximum).')
  const image = await loadImage(file)
  // Un SVG sans dimensions s'affiche en 300 × 150 : on le dessine plus grand.
  const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 2
  const baseW = image.naturalWidth || 1200
  const scale = Math.min(1, MAX_SIDE / Math.max(baseW, baseW / ratio))
  const isSvg = file.type.includes('svg')
  const width = Math.round(isSvg ? 1200 : baseW * scale)
  const height = Math.round(width / ratio)

  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const sctx = source.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(image, 0, 0, width, height)
  URL.revokeObjectURL(image.src)

  const box = trimBounds(sctx, width, height)
  const fit = Math.min(1, MAX_SIDE / Math.max(box.w, box.h))
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(box.w * fit))
  out.height = Math.max(1, Math.round(box.h * fit))
  const octx = out.getContext('2d', { willReadFrequently: true })!
  octx.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height)

  const sample = document.createElement('canvas')
  sample.width = 96
  sample.height = Math.max(1, Math.round((96 * out.height) / out.width))
  const pctx = sample.getContext('2d', { willReadFrequently: true })!
  pctx.drawImage(out, 0, 0, sample.width, sample.height)
  const [primary, secondary] = dominantColors(pctx, sample.width, sample.height)

  return { dataUrl: out.toDataURL('image/png'), primary, secondary }
}
