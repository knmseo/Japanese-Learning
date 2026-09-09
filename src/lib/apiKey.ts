import { db } from './db'

const API_KEY_SETTING = 'anthropicApiKey'

/** Set in .env.local so the key never has to be pasted into the UI. */
const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY?.trim()

export async function getApiKey(): Promise<string | null> {
  if (envKey) return envKey
  const setting = await db.settings.get(API_KEY_SETTING)
  return setting?.value ?? null
}

export async function setApiKey(value: string): Promise<void> {
  await db.settings.put({ key: API_KEY_SETTING, value })
}

export async function clearApiKey(): Promise<void> {
  await db.settings.delete(API_KEY_SETTING)
}
