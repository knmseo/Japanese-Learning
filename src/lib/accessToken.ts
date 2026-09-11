import { db } from './db'

const SETTING_KEY = 'accessToken'
/** Query parameter on an invite link: https://…/?k=TOKEN */
const INVITE_PARAM = 'k'

/**
 * The invite token for the shared TTS proxy (§2 amendment).
 *
 * Delivered as a link rather than a code to type: opening `/?k=TOKEN` once
 * stores the token and strips it from the URL, so an invited friend never sees
 * a login screen or enters anything. The stripping matters — otherwise the
 * token sits in the address bar to be screenshotted, shared, or captured in a
 * browser-history sync.
 *
 * This is an invite, not authentication. It gates use of the owner's OpenAI
 * credit; it protects nothing personal, because there is nothing personal on
 * the server — all study data stays on the device (§2).
 */
export async function getAccessToken(): Promise<string | null> {
  return (await db.settings.get(SETTING_KEY))?.value ?? null
}

export async function setAccessToken(value: string): Promise<void> {
  await db.settings.put({ key: SETTING_KEY, value })
}

export async function clearAccessToken(): Promise<void> {
  await db.settings.delete(SETTING_KEY)
}

/**
 * Consumes `?k=…` on startup. Runs before anything asks for audio, so a fresh
 * invite works on the very first sentence rather than the second visit.
 */
export async function consumeInviteFromUrl(): Promise<void> {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const token = url.searchParams.get(INVITE_PARAM)?.trim()
  if (!token) return

  await setAccessToken(token)

  url.searchParams.delete(INVITE_PARAM)
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}
