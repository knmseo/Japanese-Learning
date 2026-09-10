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

export async function deleteSavedSegmentById(id: string): Promise<void> {
  await db.savedSegments.delete(id)
}
