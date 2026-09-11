import { db } from './db'
import { getOpenAiApiKey } from './apiKey'
import { hashText } from './hash'
import type { Sentence } from './types'

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
 * What TTS should actually say for a sentence: its kana `reading` when the deck
 * supplies one, otherwise the sentence as written (§8).
 *
 * Every caller that touches audio goes through this — the player, the commute
 * bundle's "is it cached?" check, and its pre-fetch. Keeping it in one place is
 * what stops the cache key and the spoken text from drifting apart, which would
 * silently cache audio under a key nothing ever looks up again.
 */
export function speechTextFor(sentence: Pick<Sentence, 'japanese' | 'reading'>): string {
  return sentence.reading?.trim() || sentence.japanese
}

/**
 * §8: cache audio by a hash of the exact text spoken — never regenerate
 * identical audio. Keyed by the spoken text rather than the displayed sentence,
 * so correcting a `reading` yields a new key and the stale clip is bypassed
 * instead of being served forever.
 *
 * TTS is generated from Japanese script — kanji or kana — never romanization.
 */
export async function getAudioForSentence(spokenText: string): Promise<Blob> {
  const hash = await hashText(spokenText)

  const cached = await db.audioCache.get(hash)
  if (cached) return cached.audio

  const audio = await fetchFromProvider(spokenText)
  await db.audioCache.put({ hash, audio, createdAt: new Date().toISOString() })
  return audio
}
