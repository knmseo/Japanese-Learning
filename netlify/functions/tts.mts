import type { Config, Context } from '@netlify/functions'

/**
 * Server-side TTS proxy (§2 amendment — see SPEC.md).
 *
 * Exists so invited users get neural audio without holding an OpenAI key. The
 * key lives in this function's environment, which is never shipped to a
 * browser — unlike `VITE_OPENAI_API_KEY`, which Vite inlines into the bundle
 * and which anyone loading a public site can read straight out of the JS.
 *
 * Access is a per-person token from `ACCESS_TOKENS`. Revoking someone means
 * removing their token from that variable and redeploying; no user accounts,
 * no passwords, no login screen to build or for a friend to get through.
 *
 * Abuse limits, in order of how much they matter:
 *   - the token allowlist — nobody without one gets in at all
 *   - model and voice are pinned here, so a caller can't ask for an expensive
 *     model or a long-form endpoint
 *   - input is length-capped, so this can't be used as a general TTS service
 *   - the browser caches every clip by hash, so normal use hits this once per
 *     sentence ever, not once per play
 */

const TTS_MODEL = 'tts-1'
const TTS_VOICE = 'alloy'
/** Long enough for any study sentence, short enough to be useless as a service. */
const MAX_INPUT_CHARS = 200

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function allowedTokens(): Set<string> {
  return new Set(
    (Netlify.env.get('ACCESS_TOKENS') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  )
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const apiKey = Netlify.env.get('OPENAI_API_KEY')
  if (!apiKey) return json({ error: 'Server has no OPENAI_API_KEY configured.' }, 503)

  const tokens = allowedTokens()
  if (tokens.size === 0) {
    // Fail closed. An empty allowlist must not mean "everyone" — that would
    // turn a misconfiguration into an open, billable endpoint.
    return json({ error: 'No access tokens configured.' }, 503)
  }

  let body: { input?: unknown; token?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400)
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!tokens.has(token)) return json({ error: 'Not invited.' }, 403)

  const input = typeof body.input === 'string' ? body.input.trim() : ''
  if (!input) return json({ error: 'Missing "input".' }, 400)
  if (input.length > MAX_INPUT_CHARS) {
    return json({ error: `Input too long (max ${MAX_INPUT_CHARS} characters).` }, 413)
  }

  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input, response_format: 'mp3' }),
  })

  if (!upstream.ok) {
    // Deliberately not forwarding the upstream body — it can echo account and
    // billing detail that invited friends have no business seeing.
    return json({ error: `Upstream TTS failed (${upstream.status}).` }, 502)
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'audio/mpeg',
      // The client caches by sentence hash in IndexedDB; this just stops
      // intermediaries re-requesting on the way.
      'cache-control': 'private, max-age=86400',
    },
  })
}

export const config: Config = {
  path: '/api/tts',
}
