import { db } from './db'
import type { StudySource } from './types'

const SETTING_KEY = 'studySource'

/**
 * What Study draws from (§16) — a deck, or one of the saved sets. Persisted
 * so the choice survives a reload, in the same `settings` table the API keys
 * use.
 */
export async function getStudySource(): Promise<StudySource | null> {
  const setting = await db.settings.get(SETTING_KEY)
  if (!setting?.value) return null
  try {
    return JSON.parse(setting.value) as StudySource
  } catch {
    return null
  }
}

export async function setStudySource(source: StudySource): Promise<void> {
  await db.settings.put({ key: SETTING_KEY, value: JSON.stringify(source) })
}

export function describeStudySource(source: StudySource, deckName?: string): string {
  if (source.kind === 'saved-sentences') return 'Saved sentences'
  if (source.kind === 'saved-words') return 'Saved words'
  return deckName ?? 'Deck'
}
