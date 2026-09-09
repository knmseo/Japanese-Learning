import { getAllConceptMasteries } from './conceptMastery'
import { getAllSentences } from './sentenceStore'
import type { ConceptMastery, ConstraintPayload } from './types'

/**
 * Novelty target from §4: 80–95% familiar, 5–20% new. Configurable rather than
 * a fixed constant, per the spec's explicit instruction.
 */
const DEFAULT_MAX_NEW_CONCEPTS = 1
const DEFAULT_TARGET_FAMILIAR_RATIO = 0.85

/** Concept-level recency window (§3): weaker concepts come back sooner. */
const MIN_REVIEW_WINDOW_DAYS = 1
const MAX_REVIEW_WINDOW_DAYS = 21

const MAX_AVOID_SENTENCES = 40

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type ConstraintPayloadOptions = {
  maxNewConcepts?: number
  targetFamiliarRatio?: number
  desiredDifficulty?: ConstraintPayload['desiredDifficulty']
  register?: ConstraintPayload['register']
}

/** A concept is due when its mastery-scaled recency window has elapsed (§3). */
function isDueByRecency(mastery: ConceptMastery, now: Date): boolean {
  const windowDays =
    MIN_REVIEW_WINDOW_DAYS + mastery.masteryScore * (MAX_REVIEW_WINDOW_DAYS - MIN_REVIEW_WINDOW_DAYS)
  const elapsedDays = (now.getTime() - new Date(mastery.lastSeenAt).getTime()) / MS_PER_DAY
  return elapsedDays >= windowDays
}

/**
 * Assembles the §4 constraint payload from the learner model. Deterministic
 * code owns concept selection and session constraints (§11); this function
 * decides *what* needs reinforcement, and the LLM only decides how to say it.
 */
export async function buildConstraintPayload(
  options: ConstraintPayloadOptions = {},
  now: Date = new Date(),
): Promise<ConstraintPayload> {
  const masteries = await getAllConceptMasteries()
  const sentences = await getAllSentences()

  const developingConcepts = masteries.filter((m) => m.status === 'developing').map((m) => m.concept)
  const knownConcepts = masteries.filter((m) => m.status === 'known').map((m) => m.concept)
  const conceptsDueForReview = masteries.filter((m) => isDueByRecency(m, now)).map((m) => m.concept)

  return {
    conceptsDueForReview,
    developingConcepts,
    knownConcepts,
    noveltyBudget: {
      maxNewConcepts: options.maxNewConcepts ?? DEFAULT_MAX_NEW_CONCEPTS,
      targetFamiliarRatio: options.targetFamiliarRatio ?? DEFAULT_TARGET_FAMILIAR_RATIO,
    },
    desiredDifficulty: options.desiredDifficulty ?? 'moderate',
    register: options.register ?? 'polite',
    avoidRepeatingSentences: sentences.slice(-MAX_AVOID_SENTENCES).map((s) => s.japanese),
  }
}
