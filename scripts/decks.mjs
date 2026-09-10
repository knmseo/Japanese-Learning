#!/usr/bin/env node
/**
 * Deck tool — validates deck JSON and rebuilds public/decks/index.json.
 *
 * The app is a reader of pre-segmented static decks (SPEC.md §16) and has no
 * backend (§2), so "uploading a deck" means dropping a validated JSON file into
 * public/decks/ and regenerating the manifest. This script is that step, plus
 * the checks that catch the mistakes which actually break the study screen.
 *
 *   node scripts/decks.mjs check     # validate every deck, don't write
 *   node scripts/decks.mjs sync      # validate, then rewrite index.json
 *
 * See DECKS.md for the authoring guide.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const decksDir = resolve(root, 'public/decks')
const manifestPath = resolve(decksDir, 'index.json')
const MANIFEST_NAME = 'index.json'

const SEGMENT_TYPES = new Set(['vocabulary', 'particle', 'construction'])
/** Mirrors src/lib/segmentationValidator.ts — punctuation may have an empty gloss. */
const PUNCTUATION_ONLY = /^[。、！？!?,.「」『』（）()・…\s]+$/u

const problems = []
const notes = []

function fail(file, message) {
  problems.push(`${file}: ${message}`)
}

function validateDeck(file, deck) {
  if (!deck || typeof deck !== 'object') return fail(file, 'not a JSON object')
  if (typeof deck.id !== 'string' || !deck.id.trim()) fail(file, 'missing "id"')
  if (typeof deck.name !== 'string' || !deck.name.trim()) fail(file, 'missing "name"')
  if (!Array.isArray(deck.sentences) || deck.sentences.length === 0) {
    return fail(file, 'missing or empty "sentences"')
  }

  const seenIds = new Set()

  deck.sentences.forEach((s, i) => {
    const where = `sentence ${i + 1}${s?.id ? ` (${s.id})` : ''}`

    if (typeof s?.id !== 'string' || !s.id.trim()) fail(file, `${where}: missing "id"`)
    else if (seenIds.has(s.id)) fail(file, `${where}: duplicate sentence id "${s.id}"`)
    else seenIds.add(s.id)

    if (typeof s?.japanese !== 'string' || !s.japanese.trim()) fail(file, `${where}: missing "japanese"`)
    if (typeof s?.translation !== 'string' || !s.translation.trim()) fail(file, `${where}: missing "translation" (Korean)`)
    if (!Array.isArray(s?.concepts) || s.concepts.length === 0) fail(file, `${where}: missing "concepts"`)

    if (s?.segments === undefined) {
      // Allowed, but the study screen then shows the whole sentence as one
      // block with no per-word glosses — worth flagging loudly.
      notes.push(`${file}: ${where} has no "segments" — it will render unsegmented`)
      return
    }

    if (!Array.isArray(s.segments) || s.segments.length === 0) {
      return fail(file, `${where}: "segments" must be a non-empty array`)
    }

    s.segments.forEach((seg, j) => {
      const segWhere = `${where} segment ${j + 1}`
      if (typeof seg?.japanese !== 'string' || seg.japanese === '') {
        fail(file, `${segWhere}: missing "japanese"`)
      }
      if (typeof seg?.korean !== 'string') {
        fail(file, `${segWhere}: missing "korean"`)
      } else if (seg.korean.trim() === '' && !PUNCTUATION_ONLY.test(seg.japanese ?? '')) {
        fail(file, `${segWhere}: empty "korean" is only allowed for punctuation`)
      }
      if (!SEGMENT_TYPES.has(seg?.type)) {
        fail(file, `${segWhere}: "type" must be one of ${[...SEGMENT_TYPES].join(', ')}`)
      }
      if (typeof seg?.baseForm !== 'string' || !seg.baseForm.trim()) {
        fail(file, `${segWhere}: missing "baseForm"`)
      }
    })

    // The single check that matters most: segments must reconstruct the
    // sentence exactly, or the card renders text that isn't the sentence.
    const rebuilt = s.segments.map((seg) => seg?.japanese ?? '').join('')
    if (rebuilt !== s.japanese) {
      fail(file, `${where}: segments don't reconstruct the sentence\n    got: ${rebuilt}\n    expected: ${s.japanese}`)
    }
  })
}

const deckFiles = readdirSync(decksDir)
  .filter((f) => f.endsWith('.json') && f !== MANIFEST_NAME)
  .sort()

if (deckFiles.length === 0) {
  console.error(`No deck files found in ${decksDir}`)
  process.exit(1)
}

const seenDeckIds = new Map()

for (const file of deckFiles) {
  let deck
  try {
    deck = JSON.parse(readFileSync(resolve(decksDir, file), 'utf8'))
  } catch (e) {
    fail(file, `invalid JSON — ${e.message}`)
    continue
  }
  validateDeck(file, deck)

  if (typeof deck?.id === 'string') {
    // Two decks sharing an id would make deck selection ambiguous (§16).
    if (seenDeckIds.has(deck.id)) fail(file, `deck id "${deck.id}" already used by ${seenDeckIds.get(deck.id)}`)
    else seenDeckIds.set(deck.id, file)
  }
}

for (const note of notes) console.warn(`warning  ${note}`)

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:\n`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error('\nNothing was written. Fix the above and re-run.')
  process.exit(1)
}

const command = process.argv[2] ?? 'check'
const sentenceCount = deckFiles.length

if (command === 'check') {
  console.log(`✓ ${sentenceCount} deck file(s) valid. Run "node scripts/decks.mjs sync" to update the manifest.`)
  process.exit(0)
}

if (command !== 'sync') {
  console.error(`Unknown command "${command}". Use "check" or "sync".`)
  process.exit(1)
}

const manifest = { decks: deckFiles }
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`✓ ${deckFiles.length} deck(s) valid — wrote ${MANIFEST_NAME}:`)
for (const f of deckFiles) console.log(`    ${f}`)
