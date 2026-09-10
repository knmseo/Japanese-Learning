import { db } from './db'

function createApiKeyStore(settingKey: string, envValue: string | undefined) {
  const envKey = envValue?.trim()

  return {
    async get(): Promise<string | null> {
      if (envKey) return envKey
      const setting = await db.settings.get(settingKey)
      return setting?.value ?? null
    },
    async set(value: string): Promise<void> {
      await db.settings.put({ key: settingKey, value })
    },
    async clear(): Promise<void> {
      await db.settings.delete(settingKey)
    },
  }
}

const anthropicKeyStore = createApiKeyStore('anthropicApiKey', import.meta.env.VITE_ANTHROPIC_API_KEY)

export const getApiKey = anthropicKeyStore.get
export const setApiKey = anthropicKeyStore.set
export const clearApiKey = anthropicKeyStore.clear

const openaiKeyStore = createApiKeyStore('openaiApiKey', import.meta.env.VITE_OPENAI_API_KEY)

export const getOpenAiApiKey = openaiKeyStore.get
export const setOpenAiApiKey = openaiKeyStore.set
export const clearOpenAiApiKey = openaiKeyStore.clear
