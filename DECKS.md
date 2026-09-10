# Adding study decks

The app is a **reader** of pre-segmented decks, never a generator (SPEC.md §16),
and it has no backend (§2). So a deck is just a JSON file that ships with the
app. "Uploading a deck" = add the file, run one command, redeploy.

## The short version

1. Write `public/decks/your-deck.json` (format below).
2. Run `npm run decks:check` — it validates and tells you exactly what's wrong.
3. Run `npm run decks:sync` — validates, then rewrites the manifest.
4. Redeploy (or just restart `npm run dev` — `sync` runs automatically first).

You never edit `public/decks/index.json` by hand. It's generated from whatever
`.json` files are sitting in `public/decks/`, so adding a deck is really just
"drop the file in, run sync."

## Deck format

```jsonc
{
  "id": "restaurant",          // unique across all decks; used to scope a session
  "name": "At the Restaurant", // shown on the deck card in Browse
  "sentences": [
    {
      "id": "rs-1",                     // unique within the deck
      "japanese": "メニューをお願いします。",
      "translation": "메뉴 부탁합니다.",   // Korean — the target language (§ header)
      "concepts": ["メニュー", "を", "お願いする"],
      "topic": "restaurants",           // optional
      "segments": [
        { "japanese": "メニュー",     "korean": "메뉴",     "type": "vocabulary",   "baseForm": "メニュー",  "concepts": ["メニュー"] },
        { "japanese": "を",           "korean": "를",       "type": "particle",     "baseForm": "を",        "concepts": ["を"] },
        { "japanese": "お願いします。", "korean": "부탁합니다", "type": "construction", "baseForm": "お願いする", "concepts": ["お願いする"] }
      ]
    }
  ]
}
```

### Field notes

| Field | Rules |
|---|---|
| `id` (deck) | Unique across every deck file. Two decks with the same id makes deck selection ambiguous. |
| `id` (sentence) | Unique within the deck. |
| `translation` | **Korean**, not English. The whole app targets a Korean speaker. |
| `concepts` | What this sentence teaches — drives concept mastery (§3) and, later, session composition (§6). Particles count. |
| `segments` | Optional but strongly recommended — without it the card shows the sentence as one unsplittable block with no per-word glosses, and tap-to-save-a-word does nothing useful. |
| `segments[].type` | One of `vocabulary`, `particle`, `construction`. |
| `segments[].korean` | May be empty **only** for punctuation-only segments. |
| `segments[].baseForm` | Dictionary form (`行きたいです` → `行く`). |

### The one rule that matters most

**Segments must concatenate back to `japanese` exactly** — same characters, same
order, including punctuation. If they don't, the card renders text that isn't
the sentence. `decks:check` verifies this for every sentence and shows you the
diff when it fails.

### How to split segments

Split by *meaning unit*, not by tokenizer output. A grammatical construction
stays together even when a morphological analyser would split it:

- `行きたいです。` → **one** segment (`行く` + the 〜たい desire form), not three
- `京都に` → **two** segments (`京都`, then the particle `に`)

Particles get their own segment, so the learner sees them as the separate,
reusable things they are.

## What the validator checks

`npm run decks:check` fails on any of:

- Invalid JSON, or missing `id` / `name` / `sentences`
- Missing `id`, `japanese`, `translation`, or `concepts` on a sentence
- Duplicate sentence ids within a deck, or duplicate deck ids across files
- A segment missing `japanese` / `korean` / `baseForm`, or with a bad `type`
- Empty `korean` on a non-punctuation segment
- **Segments that don't reconstruct the sentence**

It warns (but doesn't fail) on a sentence with no `segments` at all.

Nothing is written when validation fails, so a broken deck can't reach the app
by way of the manifest.

## Where the data goes at runtime

On load the app fetches the manifest and each deck, then:

- Sentences go into memory for the session generator.
- Each sentence's `segments` are seeded into the `segmentations` table in
  IndexedDB, keyed by a hash of the Japanese text. **Existing rows are left
  alone**, so a correction you make later isn't clobbered by a redeploy.
- Each deck file is cached in the `deckCache` table so sessions still cold-start
  with no network (§9).

That caching has one consequence worth knowing: **if you edit a sentence's
segments in a deck you've already loaded, the app keeps the old cached
segmentation** for that exact Japanese text. Changing the Japanese text itself
produces a new hash and re-seeds normally. To force a refresh of an unchanged
sentence, clear the `segmentations` row (or the site's IndexedDB) in devtools.

## Deploying

Static files — nothing special. `npm run build` runs `decks:sync` first, so the
manifest in `dist/` always matches the deck files that shipped with it. Upload
`dist/` wherever you host it.
