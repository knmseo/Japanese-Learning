import { type Card, createEmptyCard, fsrs, type Grade, State } from 'ts-fsrs'
import type { Comprehension, FsrsRating, SentenceFsrsState } from './types'

const f = fsrs()

function toFsrsCard(state: SentenceFsrsState | undefined): Card {
  if (!state) return createEmptyCard()
  return {
    due: new Date(state.dueAt),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: state.reps,
    lapses: 0,
    state: state.reps === 0 ? State.New : State.Review,
    last_review: new Date(state.lastReviewedAt),
  }
}

/**
 * Advances a sentence's FSRS state from a comprehension-derived rating.
 * `rating` is already mapped from the 3-way comprehension response (§2).
 */
export function scheduleNext(
  sentenceId: string,
  currentState: SentenceFsrsState | undefined,
  rating: FsrsRating,
  now: Date = new Date(),
): SentenceFsrsState {
  const card = toFsrsCard(currentState)
  const { card: nextCard } = f.next(card, now, rating as Grade)

  return {
    sentenceId,
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    dueAt: nextCard.due.toISOString(),
    lastReviewedAt: now.toISOString(),
    reps: nextCard.reps,
  }
}

/** Comprehension response (§1) → FSRS rating (§2). Deterministic mapping, not LLM-driven. */
export function comprehensionToFsrsRating(comprehension: Comprehension): FsrsRating {
  switch (comprehension) {
    case 1:
      return 4 // Easy -> Easy
    case 2:
      return 2 // Needed text -> Hard
    case 3:
      return 1 // Don't know -> Again
  }
}
