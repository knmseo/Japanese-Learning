import { sentenceBank } from '@/data/sentences'
import { db } from './db'

const DEFAULT_SESSION_SIZE = 10

/**
 * Basic due-based session (Phase 0): sentences whose FSRS state is due
 * (or never reviewed) come first, then remaining sentences fill the rest.
 * No concept-rollup weighting, LLM generation, or topic weighting yet —
 * those are later phases (§13).
 */
export async function generateSession(
  now: Date = new Date(),
  sessionSize: number = DEFAULT_SESSION_SIZE,
): Promise<string[]> {
  const states = await db.fsrsStates.toArray()
  const stateBySentenceId = new Map(states.map((s) => [s.sentenceId, s]))

  const due: string[] = []
  const unseen: string[] = []
  const notDue: string[] = []

  for (const sentence of sentenceBank) {
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
