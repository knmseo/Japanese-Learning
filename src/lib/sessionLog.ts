import { db } from './db'
import { generateId } from './id'

/**
 * Records each study session in the `sessions` table (§2, §10).
 *
 * The table was declared from Phase 0 but never written to, so §10's "sessions
 * completed" had nothing behind it — the stats screen could only report review
 * counts. Starting a session writes a row; finishing it stamps `completedAt`.
 *
 * Abandoned sessions deliberately stay in the table without a `completedAt`.
 * They cost nothing, they don't inflate the completed count, and "started 40,
 * finished 12" is the more honest picture if it's ever worth showing.
 */
export async function startSessionRecord(sentenceIds: string[]): Promise<string | null> {
  // An empty session (no deck, or an empty saved set) isn't worth recording.
  if (sentenceIds.length === 0) return null

  const id = generateId()
  await db.sessions.add({
    id,
    startedAt: new Date().toISOString(),
    sentenceIds,
    currentIndex: 0,
  })
  return id
}

/** Keeps `currentIndex` current, so an interrupted session shows how far it got. */
export async function recordSessionProgress(sessionId: string | null, currentIndex: number): Promise<void> {
  if (!sessionId) return
  await db.sessions.update(sessionId, { currentIndex })
}

export async function completeSessionRecord(sessionId: string | null): Promise<void> {
  if (!sessionId) return
  await db.sessions.update(sessionId, { completedAt: new Date().toISOString() })
}

export async function countCompletedSessions(): Promise<number> {
  const all = await db.sessions.toArray()
  return all.filter((s) => s.completedAt).length
}
