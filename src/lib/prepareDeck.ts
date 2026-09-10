import { db } from './db'
import { getAllSentences } from './sentenceStore'
import { getOrCreateSegmentation } from './segmentationGenerator'

export type PrepareDeckProgress = {
  done: number
  total: number
  currentJapanese: string
}

export type PrepareDeckResult = {
  total: number
  newlyPrepared: number
  alreadyCached: number
  failed: { japanese: string; error: string }[]
}

/**
 * §15's "prepare deck before studying" workflow — the only place in the app
 * that bulk-triggers segmentation LLM calls. Meant to be run deliberately,
 * ahead of a study session, not automatically. Sequential (not parallel) so
 * later sentences benefit from the canonical-gloss registry entries earlier
 * ones just wrote — parallelizing would lose that consistency benefit.
 */
export async function prepareDeck(onProgress?: (progress: PrepareDeckProgress) => void): Promise<PrepareDeckResult> {
  const sentences = await getAllSentences()
  const result: PrepareDeckResult = { total: sentences.length, newlyPrepared: 0, alreadyCached: 0, failed: [] }

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    onProgress?.({ done: i, total: sentences.length, currentJapanese: sentence.japanese })

    try {
      const { wasCached } = await getOrCreateSegmentation(sentence.japanese, sentence.translation)
      if (wasCached) result.alreadyCached++
      else result.newlyPrepared++
    } catch (e) {
      result.failed.push({ japanese: sentence.japanese, error: e instanceof Error ? e.message : String(e) })
    }
  }

  onProgress?.({ done: sentences.length, total: sentences.length, currentJapanese: '' })
  return result
}

/**
 * Wipes every cached segmentation so the next Prepare Deck regenerates from
 * scratch — needed whenever the generation prompt/validator changes and old
 * cache entries no longer reflect current quality. Does NOT touch
 * savedSegments: a user's saved vocabulary is independent data (a snapshot
 * of japanese/baseForm/concepts), not a live reference into this table.
 */
export async function clearAllSegmentations(): Promise<number> {
  const count = await db.segmentations.count()
  await db.segmentations.clear()
  return count
}
