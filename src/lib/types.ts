/** `translation` is Korean (the app's target language — see SPEC.md §1 note). */
export type Sentence = {
  id: string
  japanese: string
  translation: string
  concepts: string[]
  topic?: string
  source: 'authored' | 'generated'
  createdAt: string
  /** Which deck JSON this came from (§16). */
  deckId?: string
}

/** A deck as authored outside the app and shipped as static JSON (§16). */
export type Deck = {
  id: string
  name: string
  sentenceCount: number
}

/** Shape of a sentence entry inside a deck JSON file — segments ship inline. */
export type DeckFileSentence = {
  id: string
  japanese: string
  translation: string
  concepts: string[]
  topic?: string
  segments?: SentenceSegment[]
}

export type DeckFile = {
  id: string
  name: string
  sentences: DeckFileSentence[]
}

export type RevealStage = 'audio_only' | 'jp_text' | 'translation'

/** 1=Easy, 2=Needed text, 3=Don't know (§1, revised from a 4-way scale in the Phase 4 UI pass). */
export type Comprehension = 1 | 2 | 3

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

/** Cached TTS audio, keyed by a hash of the exact sentence text (§8). */
export type AudioCacheEntry = {
  hash: string
  audio: Blob
  createdAt: string
}

/** One learner-oriented aligned chunk within a segmented sentence (§15). */
export type SegmentType = 'vocabulary' | 'particle' | 'construction' | 'other'

export type SentenceSegment = {
  japanese: string
  korean: string
  type: SegmentType
  /** Dictionary/base form — how conjugated verbs are matched back to a concept. */
  baseForm: string
  /** Concepts this chunk represents; a construction can map to more than one (e.g. 行きたい → [行く, 〜たい]). */
  concepts: string[]
}

/**
 * A sentence's segmentation, cached by hashText(japanese) — same cache
 * discipline as audioCache (§8): generate once, never regenerate. `source`
 * distinguishes an LLM-produced segmentation from a human correction, which
 * is never re-generated over.
 */
export type SentenceSegmentation = {
  hash: string
  japanese: string
  naturalKorean: string
  segments: SentenceSegment[]
  createdAt: string
  /** 'tokenizer-fallback' is a display-time-only synthesis (getSegmentationForDisplay), never persisted. */
  source: 'llm' | 'manual' | 'tokenizer-fallback'
}

/** Structured JSON the LLM must return for segmentation (§15). */
export type GeneratedSegmentation = {
  segments: SentenceSegment[]
}

/** Outcome of the segmentation validate-and-regenerate loop (§15). */
export type ValidatedSegmentation =
  | { status: 'valid'; segments: SentenceSegment[]; attempts: number }
  | { status: 'fallback'; segments: SentenceSegment[]; attempts: number }

/**
 * A learner tapped a segment to save it for later review — a thin pointer,
 * not a parallel scheduling system. Its concepts roll up through the
 * existing ConceptMastery pipeline (§3); saving itself never mutates
 * mastery scores, only actual sentence reviews do.
 */
export type SavedSegment = {
  id: string
  japanese: string
  baseForm: string
  concepts: string[]
  sourceSentenceHash: string
  savedAt: string
}

/** A whole sentence starred during study (§16), for later focused review. */
export type SavedSentence = {
  id: string
  sentenceId: string
  japanese: string
  translation: string
  savedAt: string
}

/**
 * What the current study session draws from (§16). Persisted in `settings`
 * so the choice survives a reload — Browse sets it, the session generator
 * resolves it to sentence ids.
 */
export type StudySource =
  | { kind: 'deck'; deckId: string }
  | { kind: 'saved-sentences' }
  | { kind: 'saved-words' }
