import Dexie, { type EntityTable } from 'dexie'
import type { ReviewLog, SentenceFsrsState, SessionState } from './types'

const db = new Dexie('japanese-acquisition') as Dexie & {
  reviewLogs: EntityTable<ReviewLog, 'id'>
  fsrsStates: EntityTable<SentenceFsrsState, 'sentenceId'>
  sessions: EntityTable<SessionState, 'id'>
}

db.version(1).stores({
  reviewLogs: 'id, sentenceId, timestamp',
  fsrsStates: 'sentenceId, dueAt',
  sessions: 'id, startedAt',
})

export { db }
