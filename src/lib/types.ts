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
