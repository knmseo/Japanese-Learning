import { deriveMasteryStatus } from './conceptMastery'
import { db } from './db'
import { hashText } from './hash'
import { getAllSentences } from './sentenceStore'
import type { ConceptMasteryRecord, Sentence, StudySource } from './types'

const DEFAULT_SESSION_SIZE = 10

/**
 * §4's novelty target is 80–95% familiar / 5–20% new, "configurable, not a
 * fixed constant" — so this is the ceiling, not a quota to hit.
 */
const DEFAULT_NOVELTY_CEILING = 0.2

/**
 * Narrows the full sentence pool to whatever the user picked in Browse
 * (§16): a deck, their starred sentences, or the sentences their saved
 * words came from. Saved segments only store `sourceSentenceHash`, so
 * matching back to sentences means hashing each sentence — cheap at this
 * scale, and it reuses the same hashText the segmentation cache is keyed by.
 */
async function sentencesForSource(source: StudySource | null, all: Sentence[]): Promise<Sentence[]> {
  if (!source) return all

  if (source.kind === 'deck') {
    return all.filter((s) => s.deckId === source.deckId)
  }

  if (source.kind === 'saved-sentences') {
    const saved = await db.savedSentences.toArray()
    const ids = new Set(saved.map((s) => s.sentenceId))
    return all.filter((s) => ids.has(s.id))
  }

  const savedSegments = await db.savedSegments.toArray()
  if (savedSegments.length === 0) return []
  const wantedHashes = new Set(savedSegments.map((s) => s.sourceSentenceHash))
  const withHashes = await Promise.all(all.map(async (s) => ({ sentence: s, hash: await hashText(s.japanese) })))
  return withHashes.filter(({ hash }) => wantedHashes.has(hash)).map(({ sentence }) => sentence)
}

/** Which §6 bucket a sentence belongs to, from its concepts' rollup mastery (§3). */
type Bucket = 'due' | 'developing' | 'new' | 'known'

type Classified = {
  sentence: Sentence
  bucket: Bucket
  /** How overdue, in ms — negative when not yet due. Orders the `due` bucket. */
  overdueMs: number
  /** Weakest concept mastery in the sentence. Orders `developing`. */
  weakestMastery: number
  /** Concepts in this sentence never encountered before. Orders `new`. */
  newConceptCount: number
}

function classify(
  sentence: Sentence,
  masteryByConcept: Map<string, ConceptMasteryRecord>,
  dueAtBySentenceId: Map<string, number>,
  nowMs: number,
): Classified {
  let weakestMastery = 1
  let newConceptCount = 0
  let hasDeveloping = false

  for (const concept of sentence.concepts) {
    const record = masteryByConcept.get(concept)
    const status = deriveMasteryStatus(record)
    if (status === 'new') newConceptCount++
    else if (status === 'developing') hasDeveloping = true
    weakestMastery = Math.min(weakestMastery, record?.masteryScore ?? 0)
  }

  const dueAt = dueAtBySentenceId.get(sentence.id)
  const overdueMs = dueAt === undefined ? 0 : nowMs - dueAt

  // FSRS's own verdict comes first: §11 puts scheduling in deterministic code,
  // and a sentence the scheduler says is due is due regardless of its concepts.
  let bucket: Bucket
  if (dueAt !== undefined && dueAt <= nowMs) bucket = 'due'
  else if (newConceptCount > 0) bucket = 'new'
  else if (hasDeveloping) bucket = 'developing'
  else bucket = 'known'

  return { sentence, bucket, overdueMs, weakestMastery, newConceptCount }
}

/**
 * §6's daily session: due reviews, then concepts still developing, then a small
 * novelty-capped slice of genuinely new material, then known sentences as
 * filler.
 *
 * Concept mastery (§3) is what distinguishes the middle two buckets — before
 * this the generator ran the Phase 0 algorithm (due → unseen → not-due) and
 * ignored the rollup entirely, so `conceptMastery` was written after every
 * review and never read. FSRS still decides what is *due*; mastery decides what
 * is worth showing once the due queue runs out.
 *
 * Deterministic throughout, per §11 — no LLM involvement in choosing what to
 * study.
 */
export async function generateSession(
  source: StudySource | null = null,
  now: Date = new Date(),
  sessionSize: number = DEFAULT_SESSION_SIZE,
  noveltyCeiling: number = DEFAULT_NOVELTY_CEILING,
): Promise<string[]> {
  const [states, masteries, allSentences] = await Promise.all([
    db.fsrsStates.toArray(),
    db.conceptMastery.toArray(),
    getAllSentences(),
  ])

  const sentences = await sentencesForSource(source, allSentences)
  const masteryByConcept = new Map(masteries.map((m) => [m.concept, m]))
  const dueAtBySentenceId = new Map(states.map((s) => [s.sentenceId, new Date(s.dueAt).getTime()]))
  const nowMs = now.getTime()

  const classified = sentences.map((s) => classify(s, masteryByConcept, dueAtBySentenceId, nowMs))

  const inBucket = (b: Bucket) => classified.filter((c) => c.bucket === b)

  // Most overdue first — the longest-neglected review is the most valuable.
  const due = inBucket('due').sort((a, b) => b.overdueMs - a.overdueMs)
  // Weakest concepts first, so shaky material gets the attention.
  const developing = inBucket('developing').sort((a, b) => a.weakestMastery - b.weakestMastery)
  // Fewest new concepts first — introduce novelty gently rather than in a clump.
  const fresh = inBucket('new').sort((a, b) => a.newConceptCount - b.newConceptCount)
  const known = inBucket('known').sort((a, b) => a.weakestMastery - b.weakestMastery)

  const picked: string[] = []
  const take = (pool: Classified[], limit: number) => {
    for (const c of pool) {
      if (picked.length >= sessionSize || limit <= 0) return
      if (picked.includes(c.sentence.id)) continue
      picked.push(c.sentence.id)
      limit--
    }
  }

  take(due, sessionSize)
  take(developing, sessionSize - picked.length)
  take(fresh, Math.ceil(sessionSize * noveltyCeiling))
  take(known, sessionSize - picked.length)

  // Cold start: with no history every concept is "new", so the novelty ceiling
  // would cap a first session at two sentences. The ceiling exists to keep new
  // material a minority of *familiar* work — when there is no familiar work to
  // be a minority of, it has nothing to limit, so fill the rest.
  take(fresh, sessionSize - picked.length)

  return picked
}
