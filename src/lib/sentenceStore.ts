import { sentenceBank } from '@/data/sentences'
import { db } from './db'
import type { Sentence } from './types'

/** Authored bank (§13 phase 0) plus any LLM-generated sentences persisted since. */
export async function getAllSentences(): Promise<Sentence[]> {
  const generated = await db.generatedSentences.toArray()
  return [...sentenceBank, ...generated]
}

export async function saveGeneratedSentence(sentence: Sentence): Promise<void> {
  await db.generatedSentences.put(sentence)
}
