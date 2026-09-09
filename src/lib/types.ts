export type Sentence = {
  id: string
  japanese: string
  translation: string
  concepts: string[]
  topic?: string
  source: 'authored' | 'generated'
  createdAt: string
}

export type RevealStage = 'audio_only' | 'jp_text' | 'translation'

export type Comprehension = 1 | 2 | 3 | 4

export type FsrsRating = 1 | 2 | 3 | 4

export type ReviewLog = {
  id: string
  sentenceId: string
  timestamp: string
  revealStage: RevealStage
  comprehension: Comprehension
  responseLatencyMs: number
  fsrsRating: FsrsRating
}

export type SentenceFsrsState = {
  sentenceId: string
  stability: number
  difficulty: number
  dueAt: string
  lastReviewedAt: string
  reps: number
}

export type SessionState = {
  id: string
  startedAt: string
  sentenceIds: string[]
  currentIndex: number
  completedAt?: string
}

export type Setting = {
  key: string
  value: string
}

export type MasteryStatus = 'new' | 'developing' | 'known'

/** Persisted shape (§3): status is a threshold read on masteryScore, computed on
 * read via `deriveMasteryStatus`, never stored as independent state. */
export type ConceptMasteryRecord = {
  concept: string
  masteryScore: number
  encounters: number
  lastSeenAt: string
}

/** Full read-side shape from §2, with `status` attached by the rollup layer. */
export type ConceptMastery = ConceptMasteryRecord & {
  status: MasteryStatus
}

/**
 * Structured constraint payload handed to the LLM (§4). Built entirely by
 * deterministic code from the learner model — the LLM never decides any of
 * this, it only expresses what the scheduler already decided (§11).
 */
export type ConstraintPayload = {
  conceptsDueForReview: string[]
  developingConcepts: string[]
  knownConcepts: string[]
  noveltyBudget: {
    maxNewConcepts: number
    targetFamiliarRatio: number
  }
  desiredDifficulty: 'easy' | 'moderate' | 'challenging'
  register: 'polite' | 'casual'
  avoidRepeatingSentences: string[]
}

/** Structured JSON the LLM must return (§4). */
export type GeneratedSentence = {
  japanese: string
  translation: string
  concepts: string[]
}

/** Outcome of the validate-and-regenerate loop (§4). */
export type ValidatedGeneration =
  | { status: 'valid'; sentence: GeneratedSentence; attempts: number; usedStrictPrompt: boolean }
  | { status: 'rejected'; attempts: number; newTokens: string[] }
