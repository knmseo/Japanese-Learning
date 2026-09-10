import { db } from './db'
import { generateId } from './id'
import type { SavedSentence, Sentence } from './types'

/** Starring a whole sentence during study (§16) — a bookmark, like saved segments. */
export async function saveSentence(sentence: Sentence): Promise<SavedSentence> {
  const record: SavedSentence = {
    id: generateId(),
    sentenceId: sentence.id,
    japanese: sentence.japanese,
    translation: sentence.translation,
    savedAt: new Date().toISOString(),
  }
  await db.savedSentences.put(record)
  return record
}

export async function isSentenceSaved(sentenceId: string): Promise<boolean> {
  return (await db.savedSentences.where('sentenceId').equals(sentenceId).count()) > 0
}

/** Starring is a toggle, same as segment saving. */
export async function unsaveSentence(sentenceId: string): Promise<void> {
  const matches = await db.savedSentences.where('sentenceId').equals(sentenceId).toArray()
  await Promise.all(matches.map((m) => db.savedSentences.delete(m.id)))
}

export async function listSavedSentences(): Promise<SavedSentence[]> {
  return db.savedSentences.orderBy('savedAt').reverse().toArray()
}
