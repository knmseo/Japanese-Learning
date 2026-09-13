import { db } from './db'
import { generateId } from './id'
import type { SavedSegment, SentenceSegment } from './types'

/**
 * Tap-to-save (§15): a thin bookmark, not a scoring action. Its concepts
 * still roll up through the existing ConceptMastery pipeline via ordinary
 * sentence reviews — saving itself never touches mastery scores.
 */
export async function saveSegment(segment: SentenceSegment, sourceSentenceHash: string): Promise<SavedSegment> {
  const record: SavedSegment = {
    id: generateId(),
    japanese: segment.japanese,
    baseForm: segment.baseForm,
    concepts: segment.concepts,
    sourceSentenceHash,
    savedAt: new Date().toISOString(),
  }
  await db.savedSegments.put(record)
  return record
}

async function findSavedSegment(japanese: string, sourceSentenceHash: string): Promise<SavedSegment | undefined> {
  const matches = await db.savedSegments.where('sourceSentenceHash').equals(sourceSentenceHash).toArray()
  return matches.find((m) => m.japanese === japanese)
}

export async function isSegmentSaved(japanese: string, sourceSentenceHash: string): Promise<boolean> {
  return (await findSavedSegment(japanese, sourceSentenceHash)) !== undefined
}

/** Tapping a saved segment again removes it — saving is a toggle, not one-way. */
export async function unsaveSegment(japanese: string, sourceSentenceHash: string): Promise<void> {
  const existing = await findSavedSegment(japanese, sourceSentenceHash)
  if (existing) await db.savedSegments.delete(existing.id)
}

/** For a future Browse-tab review view (§15) — already-real storage, not a placeholder. */
export async function listSavedSegments(): Promise<SavedSegment[]> {
  return db.savedSegments.orderBy('savedAt').reverse().toArray()
}

/** A saved word with the Korean gloss it was saved alongside. */
export type SavedWord = SavedSegment & { korean: string }

/**
 * Saved words for the Saved Words overlay, newest first.
 *
 * A SavedSegment deliberately stores no Korean: the gloss belongs to the
 * segmentation, not the bookmark, so correcting a segmentation corrects every
 * saved word that came from it rather than leaving stale copies behind. That
 * means the meaning has to be joined back on read, via the sourceSentenceHash
 * the bookmark keeps for exactly this purpose.
 *
 * Segmentations are fetched once per distinct hash rather than once per word —
 * several saved words usually come from the same sentence. A word whose
 * segmentation has since been evicted falls back to its own base form, so it
 * still shows something rather than an empty card.
 */
export async function listSavedWords(): Promise<SavedWord[]> {
  const saved = await listSavedSegments()
  if (saved.length === 0) return []

  const hashes = [...new Set(saved.map((s) => s.sourceSentenceHash))]
  const segmentations = await db.segmentations.bulkGet(hashes)
  const byHash = new Map(hashes.map((h, i) => [h, segmentations[i]]))

  return saved.map((word) => ({
    ...word,
    korean: byHash.get(word.sourceSentenceHash)?.segments.find((s) => s.japanese === word.japanese)?.korean
      ?? word.baseForm,
  }))
}

export async function deleteSavedSegmentById(id: string): Promise<void> {
  await db.savedSegments.delete(id)
}
