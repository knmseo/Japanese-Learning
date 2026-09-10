import Dexie, { type EntityTable } from 'dexie'
import type {
  AudioCacheEntry,
  ConceptMasteryRecord,
  ReviewLog,
  SavedSegment,
  SavedSentence,
  Sentence,
  SentenceFsrsState,
  SentenceSegmentation,
  SessionState,
  Setting,
} from './types'

const db = new Dexie('japanese-acquisition') as Dexie & {
  reviewLogs: EntityTable<ReviewLog, 'id'>
  fsrsStates: EntityTable<SentenceFsrsState, 'sentenceId'>
  sessions: EntityTable<SessionState, 'id'>
  conceptMastery: EntityTable<ConceptMasteryRecord, 'concept'>
  generatedSentences: EntityTable<Sentence, 'id'>
  settings: EntityTable<Setting, 'key'>
  audioCache: EntityTable<AudioCacheEntry, 'hash'>
  segmentations: EntityTable<SentenceSegmentation, 'hash'>
  savedSegments: EntityTable<SavedSegment, 'id'>
  savedSentences: EntityTable<SavedSentence, 'id'>
}

db.version(1).stores({
  reviewLogs: 'id, sentenceId, timestamp',
  fsrsStates: 'sentenceId, dueAt',
  sessions: 'id, startedAt',
})

db.version(2).stores({
  reviewLogs: 'id, sentenceId, timestamp',
  fsrsStates: 'sentenceId, dueAt',
  sessions: 'id, startedAt',
  conceptMastery: 'concept, lastSeenAt',
})

db.version(3).stores({
  reviewLogs: 'id, sentenceId, timestamp',
  fsrsStates: 'sentenceId, dueAt',
  sessions: 'id, startedAt',
  conceptMastery: 'concept, lastSeenAt',
  generatedSentences: 'id, createdAt',
  settings: 'key',
})

db.version(4).stores({
  reviewLogs: 'id, sentenceId, timestamp',
  fsrsStates: 'sentenceId, dueAt',
  sessions: 'id, startedAt',
  conceptMastery: 'concept, lastSeenAt',
  generatedSentences: 'id, createdAt',
  settings: 'key',
  audioCache: 'hash, createdAt',
})

db.version(5).stores({
  reviewLogs: 'id, sentenceId, timestamp',
  fsrsStates: 'sentenceId, dueAt',
  sessions: 'id, startedAt',
  conceptMastery: 'concept, lastSeenAt',
  generatedSentences: 'id, createdAt',
  settings: 'key',
  audioCache: 'hash, createdAt',
  segmentations: 'hash, createdAt',
  savedSegments: 'id, sourceSentenceHash, savedAt, *concepts',
})

db.version(6).stores({
  reviewLogs: 'id, sentenceId, timestamp',
  fsrsStates: 'sentenceId, dueAt',
  sessions: 'id, startedAt',
  conceptMastery: 'concept, lastSeenAt',
  generatedSentences: 'id, createdAt',
  settings: 'key',
  audioCache: 'hash, createdAt',
  segmentations: 'hash, createdAt',
  savedSegments: 'id, sourceSentenceHash, savedAt, *concepts',
  savedSentences: 'id, sentenceId, savedAt',
})

export { db }
