import type { SentenceSegment } from './types'

export type SegmentationValidationResult = { ok: true } | { ok: false; reason: string }

/** Matches a segment that's nothing but punctuation/symbols — these legitimately have no Korean
 * translation (a "," for "、" is not a translation, it's the validator forcing a fabrication). */
const PUNCTUATION_ONLY = /^[。、！？!?,.「」『』（）()・…\s]+$/u

/**
 * Structural sanity check for LLM-produced segmentation (§15) — deliberately
 * NOT a linguistic correctness check (that's the LLM's job, per §11-style
 * boundary: the LLM owns chunking judgment, deterministic code only verifies
 * it didn't drop or invent characters).
 */
export function validateSegmentation(japanese: string, segments: SentenceSegment[]): SegmentationValidationResult {
  if (segments.length === 0) {
    return { ok: false, reason: 'No segments returned.' }
  }

  for (const segment of segments) {
    if (!segment.japanese.trim()) return { ok: false, reason: 'A segment has empty Japanese text.' }
    if (!segment.baseForm.trim()) return { ok: false, reason: `Segment "${segment.japanese}" has an empty baseForm.` }
    if (!segment.korean.trim() && !PUNCTUATION_ONLY.test(segment.japanese)) {
      return { ok: false, reason: `Segment "${segment.japanese}" has empty Korean.` }
    }
  }

  const reconstructed = segments.map((s) => s.japanese).join('')
  if (reconstructed !== japanese) {
    return {
      ok: false,
      reason: `Segments don't reconstruct the original sentence. Expected "${japanese}", got "${reconstructed}".`,
    }
  }

  return { ok: true }
}
