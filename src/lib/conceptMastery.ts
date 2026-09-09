import { db } from './db'
import type { ConceptMastery, ConceptMasteryRecord, FsrsRating, MasteryStatus } from './types'

/**
 * Simple weighted rolling update (§3) — not Bayesian Knowledge Tracing or
 * similar. Recency is handled by the exponential-moving-average itself
 * (older encounters lose influence geometrically), not by a separate
 * time-decay term.
 */
const LEARNING_RATE = 0.3
const KNOWN_THRESHOLD = 0.8

/** fsrsRating (1=Again..4=Easy) → per-encounter accuracy in [0, 1]. */
function accuracyFromFsrsRating(fsrsRating: FsrsRating): number {
  return (fsrsRating - 1) / 3
}

export function deriveMasteryStatus(record: ConceptMasteryRecord | undefined): MasteryStatus {
  if (!record || record.encounters === 0) return 'new'
  return record.masteryScore >= KNOWN_THRESHOLD ? 'known' : 'developing'
}

export function toConceptMastery(record: ConceptMasteryRecord): ConceptMastery {
  return { ...record, status: deriveMasteryStatus(record) }
}

/** Rolls one concept's mastery forward from a single review encounter. */
async function updateOneConcept(concept: string, fsrsRating: FsrsRating, now: Date): Promise<void> {
  const accuracy = accuracyFromFsrsRating(fsrsRating)
  const existing = await db.conceptMastery.get(concept)

  const masteryScore = existing
    ? existing.masteryScore + LEARNING_RATE * (accuracy - existing.masteryScore)
    : accuracy

  const record: ConceptMasteryRecord = {
    concept,
    masteryScore,
    encounters: (existing?.encounters ?? 0) + 1,
    lastSeenAt: now.toISOString(),
  }

  await db.conceptMastery.put(record)
}

/** Rolls up mastery for every concept touched by one sentence review. */
export async function updateConceptsForReview(concepts: string[], fsrsRating: FsrsRating, now: Date = new Date()): Promise<void> {
  await Promise.all(concepts.map((concept) => updateOneConcept(concept, fsrsRating, now)))
}

export async function getConceptMastery(concept: string): Promise<ConceptMastery> {
  const record = await db.conceptMastery.get(concept)
  return record ? toConceptMastery(record) : { concept, masteryScore: 0, encounters: 0, lastSeenAt: '', status: 'new' }
}

export async function getAllConceptMasteries(): Promise<ConceptMastery[]> {
  const records = await db.conceptMastery.toArray()
  return records.map(toConceptMastery)
}
