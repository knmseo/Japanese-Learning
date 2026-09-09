import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { getApiKey } from './apiKey'
import type { ConstraintPayload, GeneratedSentence } from './types'

const MODEL = 'claude-opus-5'

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

/**
 * Sends the constraint payload (§4) to the LLM and returns its structured JSON.
 *
 * Unvalidated (§13 phase 2): the tokenizer-based constraint check and the
 * bounded regenerate loop from §4 are phase 3 and are deliberately not here.
 */
export async function generateSentence(payload: ConstraintPayload): Promise<GeneratedSentence> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('No Anthropic API key saved.')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(GeneratedSentenceSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined this request.')
  }
  if (!response.parsed_output) {
    throw new Error('The model did not return a usable sentence.')
  }

  return response.parsed_output
}
