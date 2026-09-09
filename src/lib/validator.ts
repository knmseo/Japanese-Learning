import { tokenize } from './tokenizer'
import type { ConstraintPayload } from './types'

/** Punctuation and symbols aren't vocabulary, so they never count against the budget. */
const IGNORED_POS = new Set(['記号'])

/** Concepts are written with a leading 〜 for bound forms (e.g. "〜たい"); tokens aren't. */
function normalizeConcept(concept: string): string {
  return concept.replace(/[〜~]/g, '').trim()
}

export type ValidationResult = {
  ok: boolean
  /** Tokens not covered by the allow-list — these consume the novelty budget. */
  newTokens: string[]
  allowedNewConcepts: number
}

/**
 * The mandatory validator from §4: tokenize with a morphological analyzer, check
 * every token against the known-vocab/grammar allow-list, and count anything
 * unrecognised against this sentence's declared novelty budget.
 */
export async function validateSentence(japanese: string, payload: ConstraintPayload): Promise<ValidationResult> {
  const allowed = new Set(
    [...payload.knownConcepts, ...payload.developingConcepts, ...payload.conceptsDueForReview].map(normalizeConcept),
  )

  const tokens = await tokenize(japanese)
  const newTokens: string[] = []

  for (const token of tokens) {
    if (IGNORED_POS.has(token.pos)) continue
    const surface = normalizeConcept(token.word)
    const lemma = normalizeConcept(token.dictionaryForm)
    if (allowed.has(surface) || allowed.has(lemma)) continue
    if (!newTokens.includes(lemma)) newTokens.push(lemma)
  }

  const allowedNewConcepts = payload.noveltyBudget.maxNewConcepts
  return {
    ok: newTokens.length <= allowedNewConcepts,
    newTokens,
    allowedNewConcepts,
  }
}
