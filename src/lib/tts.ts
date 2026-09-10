import { db } from './db'
import { getOpenAiApiKey } from './apiKey'
import { hashText } from './hash'

/**
 * §8: one reasonable neural TTS provider. OpenAI TTS was picked over Google
 * Cloud TTS / Azure Neural for setup weight — a single API key, no cloud
 * project or service account, consistent with how the Claude key already
 * works (§2: client-side only, no backend).
 */
const TTS_MODEL = 'tts-1'
const TTS_VOICE = 'alloy'

export class MissingOpenAiKeyError extends Error {
  constructor() {
    super('No OpenAI API key saved.')
    this.name = 'MissingOpenAiKeyError'
  }
}

async function fetchFromProvider(text: string): Promise<Blob> {
  const apiKey = await getOpenAiApiKey()
  if (!apiKey) throw new MissingOpenAiKeyError()

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`TTS request failed (${response.status}): ${body || response.statusText}`)
  }

  return response.blob()
}

/**
 * §8: cache audio by a hash of the exact sentence text — never regenerate
 * identical audio. TTS is generated directly from the Japanese text, never
 * from romanization.
 */
export async function getAudioForSentence(japanese: string): Promise<Blob> {
  const hash = await hashText(japanese)

  const cached = await db.audioCache.get(hash)
  if (cached) return cached.audio

  const audio = await fetchFromProvider(japanese)
  await db.audioCache.put({ hash, audio, createdAt: new Date().toISOString() })
  return audio
}
