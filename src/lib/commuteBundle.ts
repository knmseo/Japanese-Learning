import { db } from './db'
import { hashText } from './hash'
import { getAudioForSentence, MissingOpenAiKeyError, speechTextFor } from './tts'
import type { Sentence } from './types'

/**
 * §9 (v1 "commute bundle"): make a session self-contained before the user
 * loses connectivity, so it runs from local storage regardless of network.
 *
 * Most of what §9 describes is already local by the time we get here — §16
 * ships decks as static JSON seeded into IndexedDB, and segmentations are
 * cached there too. TTS audio is the one piece that still needs the network,
 * so it's the only thing this module fetches. Everything it writes goes
 * through the same `audioCache` table the player already reads from (§8), so
 * a prepared session and a naturally-warmed cache are indistinguishable.
 */

export type BundleStatus = {
  /** Sentences in the session. */
  total: number
  /** How many already have audio on disk. */
  ready: number
  /** True once every sentence's audio is cached — the session is commute-safe. */
  complete: boolean
}

export type PrepareResult = {
  fetched: number
  alreadyCached: number
  /** Sentences whose audio couldn't be fetched — no key, no credits, or offline. */
  failed: number
  /** Set when nothing could be fetched because no OpenAI key is saved. */
  missingKey: boolean
}

/** How much of this session is already playable offline. */
export async function getBundleStatus(sentences: Sentence[]): Promise<BundleStatus> {
  const hashes = await Promise.all(sentences.map((s) => hashText(speechTextFor(s))))
  const rows = await db.audioCache.bulkGet(hashes)
  const ready = rows.filter(Boolean).length
  return { total: sentences.length, ready, complete: sentences.length > 0 && ready === sentences.length }
}

/**
 * Pre-fetch audio for every piece of spoken text that doesn't have it yet.
 *
 * Sequential on purpose: this is a paid API (§8) and a burst of parallel
 * requests is the fastest way to hit a provider rate limit, which would fail
 * the very clips we're trying to guarantee. One at a time also makes the
 * progress count honest.
 *
 * Takes plain strings rather than sentences so the same path serves the
 * commute bundle and the saved-word list — both are "make these speakable
 * offline", and they must share a cache keyed the same way or one would
 * re-download what the other already has.
 */
export async function prepareSpeech(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<PrepareResult> {
  const result: PrepareResult = { fetched: 0, alreadyCached: 0, failed: 0, missingKey: false }

  for (const [i, text] of texts.entries()) {
    const hash = await hashText(text)
    if (await db.audioCache.get(hash)) {
      result.alreadyCached++
    } else {
      try {
        await getAudioForSentence(text)
        result.fetched++
      } catch (e) {
        result.failed++
        if (e instanceof MissingOpenAiKeyError) {
          // No key means every remaining item fails the same way. Stop rather
          // than walking the whole list to prove it.
          result.missingKey = true
          onProgress?.(texts.length, texts.length)
          return result
        }
      }
    }
    onProgress?.(i + 1, texts.length)
  }

  return result
}

/** Pre-fetch audio for every sentence in the session that doesn't have it yet. */
export async function prepareBundle(
  sentences: Sentence[],
  onProgress?: (done: number, total: number) => void,
): Promise<PrepareResult> {
  return prepareSpeech(sentences.map(speechTextFor), onProgress)
}
