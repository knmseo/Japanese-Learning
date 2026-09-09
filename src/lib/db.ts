import Dexie, { type EntityTable } from 'dexie'
import type { ConceptMasteryRecord, ReviewLog, Sentence, SentenceFsrsState, SessionState, Setting } from './types'

const db = new Dexie('japanese-acquisition') as Dexie & {
  reviewLogs: EntityTable<ReviewLog, 'id'>
  fsrsStates: EntityTable<SentenceFsrsState, 'sentenceId'>
  sessions: EntityTable<SessionState, 'id'>
  conceptMastery: EntityTable<ConceptMasteryRecord, 'concept'>
  generatedSentences: EntityTable<Sentence, 'id'>
  settings: EntityTable<Setting, 'key'>
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

export { db }
