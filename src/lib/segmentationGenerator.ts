import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { getApiKey } from './apiKey'
import { getCanonicalGlosses } from './conceptGlossRegistry'
import { db } from './db'
import { validateSegmentation } from './segmentationValidator'
import { hashText } from './hash'
import { tokenize } from './tokenizer'
import type { SentenceSegment, SentenceSegmentation, ValidatedSegmentation } from './types'

const MODEL = 'claude-opus-5'
const MAX_ATTEMPTS = 2

const SegmentSchema = z.object({
  japanese: z.string(),
  korean: z.string(),
  type: z.enum(['vocabulary', 'particle', 'construction', 'other']),
  baseForm: z.string(),
  concepts: z.array(z.string()),
})

const GeneratedSegmentationSchema = z.object({
  segments: z.array(SegmentSchema),
})

const SYSTEM_PROMPT = `You segment a Japanese sentence into learner-oriented chunks aligned with its Korean translation, for a language-learning app.

Goal: pattern recognition. A learner should notice the same particles, vocabulary, and grammatical constructions recurring across many sentences (e.g. 日本 | に | 行きたい, 学校 | に | 行きたい). Consistency across sentences matters more than a perfectly literal translation of any single sentence.

You will receive:
- the Japanese sentence and its natural Korean translation (already fixed — do not change either)
- a morphological tokenization (surface form, part of speech, dictionary form for each token) — a starting point, not a contract. You may merge tokens into one chunk when a construction spans them.
- \`canonicalGlosses\`: concepts that already have an established Korean gloss from previously segmented sentences. Prefer them, so the same concept looks familiar across sentences — BUT grammatical correctness always wins. Japanese particles in particular do not map to one fixed Korean particle: 友達に会う takes 를/을 (친구를 만나요), while 京都に行く takes 에 (교토에 가요). If the canonical gloss would be ungrammatical in THIS sentence, use the correct form instead of the canonical one. Never produce Korean that a native speaker wouldn't say just to stay consistent.

Rules:
- The segments' \`japanese\` fields, concatenated in order, must reconstruct the original sentence EXACTLY (same characters, same punctuation, nothing dropped or added).
- Do NOT force one-token-to-one-token mapping. Group a construction into one chunk when splitting it would be meaningless or misleading (e.g. ～たい, ～てもいい, ～なければならない, ～てください, ～ことがある often belong grouped with the verb they attach to).
- Punctuation (。、！？「」etc.) is NEVER its own segment and NEVER gets a translated Korean value (do not render "、" as "," or "。" as "."). Attach it to the end of the adjacent word's \`japanese\` field instead — e.g. "会います。" is one segment with korean "만나요", not two segments where "。" gets its own fabricated gloss.
- Each segment's \`baseForm\` is the dictionary form of its core word (from the tokenization when possible).
- Each segment's \`concepts\` lists every reusable concept it represents. A grouped construction like 行きたい should list BOTH the underlying verb and the grammar pattern, e.g. ["行く", "〜たい"] — never treat a construction as one opaque, unrelated vocabulary item when it decomposes into concepts the learner has seen elsewhere.
- Particles are usually their own segment.
- \`type\`: "vocabulary" for content words, "particle" for particles, "construction" for a grouped grammar pattern, "other" only for a standalone filler that truly isn't part of an adjacent word.
- Prefer segments that are meaningful, reusable, and recognizable when the learner encounters the same concept in a different sentence — not raw morphological boundaries for their own sake.`

function buildUserContent(
  japanese: string,
  naturalKorean: string,
  tokens: { word: string; pos: string; dictionaryForm: string }[],
  canonicalGlosses: Record<string, string>,
): string {
  return JSON.stringify({ japanese, naturalKorean, tokens, canonicalGlosses }, null, 2)
}

async function requestSegmentation(
  japanese: string,
  naturalKorean: string,
  tokens: { word: string; pos: string; dictionaryForm: string }[],
  canonicalGlosses: Record<string, string>,
  rejectedReason?: string,
): Promise<SentenceSegment[]> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('No Anthropic API key saved.')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const userContent = rejectedReason
    ? `${buildUserContent(japanese, naturalKorean, tokens, canonicalGlosses)}\n\nYour previous attempt was rejected: ${rejectedReason}. Try again, making sure the segments' japanese fields concatenate back to the exact original sentence.`
    : buildUserContent(japanese, naturalKorean, tokens, canonicalGlosses)

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(GeneratedSegmentationSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  if (response.stop_reason === 'refusal') throw new Error('The model declined this request.')
  if (!response.parsed_output) throw new Error('The model did not return usable segments.')

  return response.parsed_output.segments
}

/** One segment per kuromoji token — the degraded-but-functional fallback when the LLM can't produce valid segments. */
function tokenizerOnlyFallback(
  tokens: { word: string; pos: string; dictionaryForm: string }[],
): SentenceSegment[] {
  return tokens.map((t) => ({
    japanese: t.word,
    korean: '',
    type: t.pos === '助詞' ? 'particle' : t.pos === '記号' ? 'other' : 'vocabulary',
    baseForm: t.dictionaryForm,
    concepts: [],
  }))
}

/**
 * §15 pipeline: tokenize → LLM segments (grounded by tokens + the canonical
 * gloss registry) → structural validation → bounded retry → tokenizer-only
 * fallback. Never blocks the UI — always returns something displayable.
 */
export async function generateValidatedSegmentation(
  japanese: string,
  naturalKorean: string,
): Promise<ValidatedSegmentation> {
  const tokens = await tokenize(japanese)
  const plainTokens = tokens.map((t) => ({ word: t.word, pos: t.pos, dictionaryForm: t.dictionaryForm }))

  const allConcepts = [...new Set(plainTokens.map((t) => t.dictionaryForm))]
  const canonicalGlosses = await getCanonicalGlosses(allConcepts)

  let rejectedReason: string | undefined
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const segments = await requestSegmentation(japanese, naturalKorean, plainTokens, canonicalGlosses, rejectedReason)
    const validation = validateSegmentation(japanese, segments)
    if (validation.ok) {
      return { status: 'valid', segments, attempts: attempt }
    }
    rejectedReason = validation.reason
  }

  return { status: 'fallback', segments: tokenizerOnlyFallback(plainTokens), attempts: MAX_ATTEMPTS }
}

/**
 * Deck-prep entry point (§15): calls the LLM. Cache-first — returns the
 * cached segmentation if one exists, else generates and caches it. This is
 * the ONLY function in the app that may trigger a segmentation LLM call —
 * it's meant to be run deliberately ("prepare deck"), never implicitly
 * during study.
 */
export async function getOrCreateSegmentation(
  japanese: string,
  naturalKorean: string,
): Promise<{ segmentation: SentenceSegmentation; wasCached: boolean }> {
  const hash = await hashText(japanese)
  const cached = await db.segmentations.get(hash)
  if (cached) return { segmentation: cached, wasCached: true }

  const result = await generateValidatedSegmentation(japanese, naturalKorean)
  const segmentation: SentenceSegmentation = {
    hash,
    japanese,
    naturalKorean,
    segments: result.segments,
    createdAt: new Date().toISOString(),
    source: 'llm',
  }
  await db.segmentations.put(segmentation)
  return { segmentation, wasCached: false }
}

/**
 * Study-time read path: cache ONLY, never calls the LLM. If the sentence
 * wasn't prepared ahead of time (§15's "prepare deck before studying"
 * workflow), falls back to the whole sentence as one segment — the known,
 * correct Korean translation is never blank, just not yet broken into
 * learning chunks. A per-token split with blank Korean would look broken;
 * this doesn't.
 */
export async function getSegmentationForDisplay(japanese: string, naturalKorean: string): Promise<SentenceSegmentation> {
  const hash = await hashText(japanese)
  const cached = await db.segmentations.get(hash)
  if (cached) return cached

  return {
    hash,
    japanese,
    naturalKorean,
    segments: [{ japanese, korean: naturalKorean, type: 'other', baseForm: japanese, concepts: [] }],
    createdAt: new Date().toISOString(),
    source: 'tokenizer-fallback',
  }
}
