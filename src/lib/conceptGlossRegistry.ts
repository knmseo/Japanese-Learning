import { db } from './db'

/**
 * §15 consistency mechanism: the single most important lever for keeping
 * segmentation consistent across thousands of sentences. Before generating a
 * new segmentation, look up whichever concepts already have an established
 * Korean gloss from prior (accepted) segmentations, and feed that back into
 * the prompt as a constraint — the same "prior state becomes a constraint"
 * principle buildConstraintPayload already uses for sentence generation.
 *
 * First-seen gloss wins (not majority vote) — simple, and a wrong early
 * gloss is something the manual-correction path (source: 'manual') fixes
 * once, not something this function should try to auto-reconcile.
 */
export async function getCanonicalGlosses(concepts: string[]): Promise<Record<string, string>> {
  if (concepts.length === 0) return {}

  const wanted = new Set(concepts)
  const registry: Record<string, string> = {}

  const all = await db.segmentations.toArray()
  // Manual corrections are the most trustworthy source — apply them last so they win.
  const bySourcePriority = [...all].sort((a) => (a.source === 'manual' ? 1 : -1))

  for (const segmentation of bySourcePriority) {
    for (const segment of segmentation.segments) {
      for (const concept of segment.concepts) {
        if (wanted.has(concept) && !(concept in registry)) {
          registry[concept] = segment.korean
        }
      }
    }
  }

  // Manual entries should override an earlier LLM gloss even if the LLM one was seen first.
  for (const segmentation of all) {
    if (segmentation.source !== 'manual') continue
    for (const segment of segmentation.segments) {
      for (const concept of segment.concepts) {
        if (wanted.has(concept)) registry[concept] = segment.korean
      }
    }
  }

  return registry
}
