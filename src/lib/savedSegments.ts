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

export async function isSegmentSaved(japanese: string, sourceSentenceHash: string): Promise<boolean> {
  const matches = await db.savedSegments.where('sourceSentenceHash').equals(sourceSentenceHash).toArray()
  return matches.some((m) => m.japanese === japanese)
}
