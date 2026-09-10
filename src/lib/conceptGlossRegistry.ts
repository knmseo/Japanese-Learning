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
 *
 * Particle-type segments are excluded entirely. Real vocabulary and set
 * constructions genuinely benefit from cross-sentence consistency (行く
 * should always gloss the same way); particles don't — which Korean
 * particle is correct depends on the governing verb, not a fixed
 * Japanese-particle-to-Korean-particle mapping (友達に会う → 친구를 만나요,
 * but 京都に行く → 교토에 가요; both use に). Handing out a "canonical" に→에
 * gloss as a constraint produced exactly this bug in practice — this
 * makes it structurally impossible rather than relying on the LLM to
 * override a bad suggestion it's been told to prefer.
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
      if (segment.type === 'particle') continue
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
      if (segment.type === 'particle') continue
      for (const concept of segment.concepts) {
        if (wanted.has(concept)) registry[concept] = segment.korean
      }
    }
  }

  return registry
}
