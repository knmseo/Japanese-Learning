import { db } from './db'
import { loadDecks } from './deckStore'
import type { Sentence } from './types'

/** Sentences from the loaded deck JSON files (§16), plus any generated ones still persisted. */
export async function getAllSentences(): Promise<Sentence[]> {
  const { sentences } = await loadDecks()
  const generated = await db.generatedSentences.toArray()
  return [...sentences, ...generated]
}

export async function saveGeneratedSentence(sentence: Sentence): Promise<void> {
  await db.generatedSentences.put(sentence)
}
