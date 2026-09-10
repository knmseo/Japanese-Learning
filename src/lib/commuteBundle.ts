import { db } from './db'
import { hashText } from './hash'
import { getAudioForSentence, MissingOpenAiKeyError } from './tts'
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
  const hashes = await Promise.all(sentences.map((s) => hashText(s.japanese)))
  const rows = await db.audioCache.bulkGet(hashes)
  const ready = rows.filter(Boolean).length
  return { total: sentences.length, ready, complete: sentences.length > 0 && ready === sentences.length }
}

/**
 * Pre-fetch audio for every sentence in the session that doesn't have it yet.
 *
 * Sequential on purpose: this is a paid API (§8) and a burst of parallel
 * requests is the fastest way to hit a provider rate limit, which would fail
 * the very sentences we're trying to guarantee. One sentence at a time also
 * makes the progress count honest.
 */
export async function prepareBundle(
  sentences: Sentence[],
  onProgress?: (done: number, total: number) => void,
): Promise<PrepareResult> {
  const result: PrepareResult = { fetched: 0, alreadyCached: 0, failed: 0, missingKey: false }

  for (const [i, sentence] of sentences.entries()) {
    const hash = await hashText(sentence.japanese)
    if (await db.audioCache.get(hash)) {
      result.alreadyCached++
    } else {
      try {
        await getAudioForSentence(sentence.japanese)
        result.fetched++
      } catch (e) {
        result.failed++
        if (e instanceof MissingOpenAiKeyError) {
          // No key means every remaining sentence fails the same way. Stop
          // rather than walking the whole session to prove it.
          result.missingKey = true
          onProgress?.(sentences.length, sentences.length)
          return result
        }
      }
    }
    onProgress?.(i + 1, sentences.length)
  }

  return result
}
