import { db } from './db'
import { hashText } from './hash'
import type { Deck, DeckFile, Sentence, SentenceSegmentation } from './types'

/**
 * §16: decks are authored outside the app and shipped as static pre-segmented
 * JSON under public/decks/. The app only reads them — it never generates
 * sentences or segmentation at runtime. index.json is a manifest because a
 * static host can't list a directory.
 */
const DECKS_ROOT = '/decks/'
const MANIFEST = `${DECKS_ROOT}index.json`

let loaded: { decks: Deck[]; sentences: Sentence[] } | null = null

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Couldn't load ${url} (${response.status})`)
  return response.json() as Promise<T>
}

/**
 * Seeds a deck's inline segments into the segmentation cache, keyed the same
 * way getSegmentationForDisplay reads them. Existing rows are left alone so a
 * manual correction is never clobbered by a redeploy.
 */
async function seedSegmentations(deckFile: DeckFile): Promise<void> {
  const rows: SentenceSegmentation[] = []

  for (const entry of deckFile.sentences) {
    if (!entry.segments?.length) continue
    const hash = await hashText(entry.japanese)
    if (await db.segmentations.get(hash)) continue
    rows.push({
      hash,
      japanese: entry.japanese,
      naturalKorean: entry.translation,
      segments: entry.segments,
      createdAt: new Date().toISOString(),
      source: 'llm',
    })
  }

  if (rows.length) await db.segmentations.bulkPut(rows)
}

/** Loads every deck in the manifest once per page load, seeding their segmentation. */
export async function loadDecks(): Promise<{ decks: Deck[]; sentences: Sentence[] }> {
  if (loaded) return loaded

  const manifest = await fetchJson<{ decks: string[] }>(MANIFEST)
  const decks: Deck[] = []
  const sentences: Sentence[] = []

  for (const file of manifest.decks) {
    const deckFile = await fetchJson<DeckFile>(`${DECKS_ROOT}${file}`)
    await seedSegmentations(deckFile)

    decks.push({ id: deckFile.id, name: deckFile.name, sentenceCount: deckFile.sentences.length })
    for (const entry of deckFile.sentences) {
      sentences.push({
        id: entry.id,
        japanese: entry.japanese,
        translation: entry.translation,
        concepts: entry.concepts,
        topic: entry.topic,
        source: 'authored',
        createdAt: new Date().toISOString(),
        deckId: deckFile.id,
      })
    }
  }

  loaded = { decks, sentences }
  return loaded
}

export async function getDecks(): Promise<Deck[]> {
  return (await loadDecks()).decks
}
