import { db } from './db'
import { getAllSentences } from './sentenceStore'

const DEFAULT_SESSION_SIZE = 10

/**
 * Basic due-based session (Phase 0): sentences whose FSRS state is due
 * (or never reviewed) come first, then remaining sentences fill the rest.
 * No concept-rollup weighting or topic weighting yet — those are later
 * phases (§13). Generated sentences enter here only by being in the store.
 */
export async function generateSession(
  now: Date = new Date(),
  sessionSize: number = DEFAULT_SESSION_SIZE,
): Promise<string[]> {
  const states = await db.fsrsStates.toArray()
  const stateBySentenceId = new Map(states.map((s) => [s.sentenceId, s]))
  const sentences = await getAllSentences()

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
