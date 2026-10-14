import { accessToken } from '../auth.js'

/**
 * Transcription des enregistrements de rendez-vous.
 *
 * Un enregistrement d'une heure pèse souvent plus que ce qu'une fonction
 * serverless accepte (4,5 Mo) et que l'API de transcription admet (25 Mo). Le
 * navigateur le décode donc lui-même, le convertit en mono 16 kHz — la qualité
 * qu'utilise la reconnaissance vocale — et l'envoie par segments de 100 s.
 */

const SAMPLE_RATE = 16_000
const SEGMENT_SECONDS = 100
const PARALLEL = 3
const MAX_FILE = 1024 * 1024 * 1024

export const isAudioFile = (file: File): boolean =>
  file.type.startsWith('audio/') || file.type.startsWith('video/') || /\.(mp3|m4a|wav|aac|ogg|oga|opus|webm|mp4|mov|flac)$/i.test(file.name)

async function decodeMono(file: File): Promise<Float32Array> {
  if (file.size > MAX_FILE) throw new Error(`${file.name} dépasse 1 Go : exporte seulement l'audio.`)
  const context = new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE)
  let buffer: AudioBuffer
  try {
    buffer = await context.decodeAudioData(await file.arrayBuffer())
  } catch {
    throw new Error(`Format non lu par le navigateur : ${file.name}. Essaie un MP3, M4A ou WAV.`)
  }
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const mono = new Float32Array(buffer.length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels
  }
  return mono
}

function wav(samples: Float32Array): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}

/** Un segment presque silencieux ne mérite pas un appel payant. */
function isSilent(samples: Float32Array): boolean {
  let peak = 0
  for (let i = 0; i < samples.length; i += 40) peak = Math.max(peak, Math.abs(samples[i]))
  return peak < 0.01
}

async function sendSegment(segment: Blob, hint: string): Promise<string> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('/api/proposals/transcribe', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          'Content-Type': 'application/octet-stream',
          'X-Transcript-Hint': encodeURIComponent(hint),
        },
        body: segment,
      })
      const payload = await response.json().catch(() => null)
      if (response.ok) return String(payload?.text ?? '')
      lastError = new Error(payload?.error ?? `Transcription refusée (${response.status}).`)
      if (response.status < 500) break
    } catch (error) {
      lastError = error as Error
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
  }
  throw lastError ?? new Error('Transcription impossible.')
}

export interface TranscriptionProgress {
  file: string
  done: number
  total: number
}

export async function transcribeFiles(
  files: File[],
  hint: string,
  onProgress: (progress: TranscriptionProgress) => void,
): Promise<string> {
  const parts: string[] = []

  for (const [index, file] of files.entries()) {
    onProgress({ file: file.name, done: 0, total: 1 })
    let samples: Float32Array | null = await decodeMono(file)
    const size = SAMPLE_RATE * SEGMENT_SECONDS
    const segments: Blob[] = []
    for (let start = 0; start < samples.length; start += size) {
      const slice = samples.subarray(start, Math.min(samples.length, start + size))
      segments.push(isSilent(slice) ? new Blob() : wav(slice))
    }
    samples = null

    const texts = new Array<string>(segments.length).fill('')
    let next = 0
    let done = 0
    const worker = async () => {
      while (next < segments.length) {
        const current = next++
        if (segments[current].size) texts[current] = await sendSegment(segments[current], hint)
        done++
        onProgress({ file: file.name, done, total: segments.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, segments.length) }, worker))

    const label = files.length > 1 ? `Enregistrement ${index + 1} (${file.name})` : `Enregistrement (${file.name})`
    parts.push(`[${label}]\n${texts.filter(Boolean).join(' ')}`)
  }

  return parts.join('\n\n')
}
