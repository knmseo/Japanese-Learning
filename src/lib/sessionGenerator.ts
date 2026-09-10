import { db } from './db'
import { hashText } from './hash'
import { getAllSentences } from './sentenceStore'
import type { Sentence, StudySource } from './types'

const DEFAULT_SESSION_SIZE = 10

/**
 * Narrows the full sentence pool to whatever the user picked in Browse
 * (§16): a deck, their starred sentences, or the sentences their saved
 * words came from. Saved segments only store `sourceSentenceHash`, so
 * matching back to sentences means hashing each sentence — cheap at this
 * scale, and it reuses the same hashText the segmentation cache is keyed by.
 */
async function sentencesForSource(source: StudySource | null, all: Sentence[]): Promise<Sentence[]> {
  if (!source) return all

  if (source.kind === 'deck') {
    return all.filter((s) => s.deckId === source.deckId)
  }

  if (source.kind === 'saved-sentences') {
    const saved = await db.savedSentences.toArray()
    const ids = new Set(saved.map((s) => s.sentenceId))
    return all.filter((s) => ids.has(s.id))
  }

  const savedSegments = await db.savedSegments.toArray()
  if (savedSegments.length === 0) return []
  const wantedHashes = new Set(savedSegments.map((s) => s.sourceSentenceHash))
  const withHashes = await Promise.all(all.map(async (s) => ({ sentence: s, hash: await hashText(s.japanese) })))
  return withHashes.filter(({ hash }) => wantedHashes.has(hash)).map(({ sentence }) => sentence)
}

/**
 * Basic due-based session (Phase 0): sentences whose FSRS state is due
 * (or never reviewed) come first, then remaining sentences fill the rest.
 * No concept-rollup weighting or topic weighting yet — those are later
 * phases (§13).
 */
export async function generateSession(
  source: StudySource | null = null,
  now: Date = new Date(),
  sessionSize: number = DEFAULT_SESSION_SIZE,
): Promise<string[]> {
  const states = await db.fsrsStates.toArray()
  const stateBySentenceId = new Map(states.map((s) => [s.sentenceId, s]))
  const sentences = await sentencesForSource(source, await getAllSentences())

  const due: string[] = []
  const unseen: string[] = []
  const notDue: string[] = []

  for (const sentence of sentences) {
    const state = stateBySentenceId.get(sentence.id)
    if (!state) {
      unseen.push(sentence.id)
    } else if (new Date(state.dueAt) <= now) {
      due.push(sentence.id)
    } else {
      notDue.push(sentence.id)
    }
  }

  return [...due, ...unseen, ...notDue].slice(0, sessionSize)
}
