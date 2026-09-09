import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { getApiKey } from './apiKey'
import type { ConstraintPayload, GeneratedSentence, ValidatedGeneration } from './types'
import { validateSentence } from './validator'

const MODEL = 'claude-opus-5'

/** §4: bounded retry, e.g. 3 attempts, then a stricter prompt. */
const MAX_ATTEMPTS = 3

const GeneratedSentenceSchema = z.object({
  japanese: z.string(),
  translation: z.string(),
  concepts: z.array(z.string()),
})

const SYSTEM_PROMPT = `You write single Japanese sentences for a learner's spaced-repetition app.

You will receive a JSON constraint payload describing what the learner already knows and what needs reinforcement. That payload is the curriculum — it was decided by the app's scheduler, not by you. Your job is only to express it as one natural Japanese sentence.

Rules:
- Write exactly one sentence. Natural, idiomatic Japanese a native speaker would actually say.
- Build it out of the learner's known and developing concepts, and the concepts due for review.
- Respect the novelty budget: introduce at most \`noveltyBudget.maxNewConcepts\` concepts the learner has not met, and keep roughly \`noveltyBudget.targetFamiliarRatio\` of the sentence familiar.
- Match the requested register and difficulty.
- Do not reuse or lightly reword anything in \`avoidRepeatingSentences\`.
- Return the concepts your sentence actually uses (vocabulary and grammar points), as they appear in the payload's vocabulary where possible.`

const STRICTER_SUFFIX = `

STRICT MODE — earlier attempts broke the novelty budget. Use ONLY words that appear in \`knownConcepts\`, \`developingConcepts\` and \`conceptsDueForReview\`, plus the copula and particles needed to make them grammatical. Prefer a shorter, plainer sentence over a natural-sounding one. Introduce no new vocabulary at all.`

/** Sends the constraint payload (§4) to the LLM and returns its structured JSON. */
export async function generateSentence(
  payload: ConstraintPayload,
  options: { strict?: boolean; rejectedFor?: string[] } = {},
): Promise<GeneratedSentence> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('No Anthropic API key saved.')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const userContent = options.rejectedFor?.length
    ? `${JSON.stringify(payload, null, 2)}\n\nYour previous sentence was rejected: these tokens are outside the learner's allow-list and exceeded the novelty budget: ${options.rejectedFor.join('、')}. Write a different sentence that avoids them.`
    : JSON.stringify(payload, null, 2)

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(GeneratedSentenceSchema),
    },
    system: options.strict ? SYSTEM_PROMPT + STRICTER_SUFFIX : SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined this request.')
  }
  if (!response.parsed_output) {
    throw new Error('The model did not return a usable sentence.')
  }

  return response.parsed_output
}

/**
 * The §4 pipeline: generate, validate against the tokenizer, and regenerate on
 * violation up to a bounded number of attempts, then try once more with a
 * stricter prompt. Only a sentence that passes validation may enter the review
 * queue; the caller falls back to authored sentences when nothing passes.
 */
export async function generateValidatedSentence(payload: ConstraintPayload): Promise<ValidatedGeneration> {
  let rejectedFor: string[] | undefined
  let last: { sentence: GeneratedSentence; newTokens: string[] } | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS + 1; attempt++) {
    const strict = attempt > MAX_ATTEMPTS
    const sentence = await generateSentence(payload, { strict, rejectedFor })
    const validation = await validateSentence(sentence.japanese, payload)

    if (validation.ok) {
      return { status: 'valid', sentence, attempts: attempt, usedStrictPrompt: strict }
    }

    last = { sentence, newTokens: validation.newTokens }
    rejectedFor = validation.newTokens
  }

  return {
    status: 'rejected',
    attempts: MAX_ATTEMPTS + 1,
    newTokens: last?.newTokens ?? [],
  }
}
