# Japanese Sentence-Acquisition App — SPEC.md

Personal-use, mobile-first PWA for Japanese acquisition via listening,
sentence-based comprehension, and adaptive spaced repetition. Single user.
Not social, not gamified — no leaderboards, XP, streak mechanics.

**Target language: Korean.** The learner is a Korean speaker; all
translations, glosses, and segment-level meanings are Korean, not English.
(Phase 0 authored the sentence bank in English without confirming this —
corrected during the Phase 4 UI pass. See §15.)

This file is the source of truth for architecture and scope. If an
implementation decision isn't here, ask before inventing one.

---

## 1. Core Learning Loop

- One sentence at a time, audio-first.
- Order of reveal: audio + Japanese text → (optional) translation. The
  Japanese text is visible from the start (revised in the Phase 4 UI pass —
  it is no longer separately gated); only the translation is revealed, and
  it stays hidden by default. No furigana — decided against; kanji render
  plain.
- Because of that, `revealStage` (§2) in practice only takes `audio_only`
  → `translation`; `jp_text` is retained in the type but no longer
  reachable.
- **Audio never autoplays** (revised again after the Phase 4 UI pass, which
  still had it firing on first look) — every `play()` call is a real,
  billed TTS request, and autoplaying on every card would spend API usage
  just for looking at a sentence. The top-right icon is the *only* way
  audio ever plays; no visible autoplay toggle or playback-speed control,
  since there's no autoplay left to toggle.
- Mobile-first controls, tap and swipe doing different jobs: **tap**
  toggles the translation reveal (tapping an open card again closes it).
  **Swipe** navigates between cards — left toward the live card, right back
  through ones already rated this session. Swiping cannot skip the current,
  unrated card: rating (below) is the only way to advance the live
  frontier, so every FSRS/ReviewLog write stays honest. A revisited past
  card opens already revealed, with no rating buttons — view-only, doesn't
  touch its existing data. Built for one-handed use while commuting.
- After each sentence, three comprehension responses (revised from the
  original four-way scale during the Phase 4 UI pass — collapsing "needed
  Japanese text" and "needed translation" into one "needed text" tier, since
  in practice the two staged-reveal levels weren't scored differently enough
  to justify separate buttons):
  1. Easy — understood immediately
  2. Needed text — required the Japanese text and/or translation reveal
  3. Don't know — did not understand
- Ratings appear only once the translation is revealed.

---

## 2. Data Model

```ts
type Sentence = {
  id: string;
  japanese: string;
  translation: string;
  concepts: string[];       // e.g. ["京都", "に", "行く", "〜たい"]
  topic?: string;           // e.g. "trains", "restaurants"
  source: "authored" | "generated";
  createdAt: string;
  deckId?: string;          // which §16 deck file this came from; scopes the session
};

type ReviewLog = {
  id: string;
  sentenceId: string;
  timestamp: string;
  revealStage: "audio_only" | "jp_text" | "translation"; // how far user needed to go
  comprehension: 1 | 2 | 3;       // maps to the three buttons above (§1)
  responseLatencyMs: number;
  fsrsRating: 1 | 2 | 3 | 4;      // derived from comprehension, feeds ts-fsrs
};

type SentenceFsrsState = {
  sentenceId: string;
  stability: number;
  difficulty: number;
  dueAt: string;
  lastReviewedAt: string;
  reps: number;
};

type ConceptMastery = {
  concept: string;
  // rollup score, NOT an independent FSRS instance — see §4
  masteryScore: number;       // 0–1, recency + accuracy weighted
  encounters: number;
  lastSeenAt: string;
  status: "new" | "developing" | "known"; // derived from masteryScore thresholds
};

type SessionState = {
  id: string;
  startedAt: string;
  sentenceIds: string[];     // the finite queue for this session
  currentIndex: number;
  completedAt?: string;
};

// §9, added in phase 5: deck JSON the app has already downloaded, so a
// session can cold-start with no network. Keyed by the filename as it
// appears in the manifest; the manifest itself is stored the same way
// under "index.json".
type DeckCacheEntry = {
  file: string;
  content: DeckFile | { decks: string[] };
  fetchedAt: string;
};
```

Storage: **Dexie.js** over IndexedDB, client-side only for v1. No backend,
no cross-device sync in v1.

The types above are the core model. Supporting tables are specified in the
sections that own them rather than duplicated here: `audioCache` (§8),
`segmentations` and `savedSegments` (§15), `savedSentences` and the study
source (§16), `deckCache` (§9), plus `settings` and `generatedSentences`.

**Current Dexie schema version: 7.** Version history — v1 review logs /
FSRS states / sessions; v2 concept mastery; v3 generated sentences +
settings; v4 audio cache; v5 segmentations + saved segments; v6 saved
sentences; v7 deck cache (§9). Bump the version and add a new
`db.version(n).stores({...})` block rather than editing an existing one —
Dexie replays them in order to migrate a user's existing database.

---

## 3. Scheduling — Sentence-Level FSRS, Concept-Level Rollup

**Decision:** FSRS runs at the *sentence* level only, via the `ts-fsrs`
package. Do not attempt to run FSRS directly on concepts — FSRS's memory
model assumes a stable stimulus reviewed repeatedly; concepts are
reinforced through *different* sentences each time, which is a different
problem (generalization, not recall of a fixed item).

Concept mastery is a **derived rollup**, not its own scheduler:
- Each review log's concepts get a small recency+accuracy-weighted update
  to their `masteryScore`.
- `status` (new/developing/known) is a threshold read on `masteryScore`,
  computed on read, not stored as independent state.
- Do not over-engineer this into Bayesian Knowledge Tracing or similar for
  v1 — a simple weighted rolling update is enough until real usage data
  shows it's insufficient.

The session generator queries: concepts overdue by rollup recency + FSRS-due
sentences, and uses that to decide what needs reinforcement (§6).

---

## 4. Generative Spaced Repetition

The scheduler (deterministic code) decides **what** needs reinforcement.
The LLM decides **how** to express it in a natural sentence.

LLM receives (as structured input, not free text):
- concepts due for review
- concepts currently developing
- known vocabulary / known grammar (the full allowed set)
- allowed *new* concepts for this sentence (novelty budget)
- desired difficulty
- previously used sentences to avoid repetition
- topic/context weighting, register/formality

LLM must return structured JSON: `{ japanese, translation, concepts[] }`.

**Mandatory validator step (do not skip):** LLMs reliably ignore "only use
these words" constraints when it makes the sentence more natural. Before a
generated sentence enters the review queue:
1. Tokenize with a morphological analyzer (Sudachi / Fugashi / MeCab).
2. Check every token against the known-vocab/grammar allow-list plus the
   declared novelty budget for this sentence.
3. If it violates the budget, regenerate (bounded retry, e.g. 3 attempts,
   then fall back to a stricter prompt or an authored sentence).

Novelty target: **80–95% familiar material, 5–20% new**, configurable, not
a fixed constant.

---

## 5. Learner Model

- Track a single comprehension-strength estimate per concept for v1 (not
  separate listening vs. reading estimates yet — with one user, splitting
  the axis early just means both halves stay noisy longer).
- Still **log** the reveal-stage/modality of every encounter
  (`revealStage` in ReviewLog) so the data exists to split the estimate
  later once there's enough volume for it to matter.
- Categories tracked per concept: new / developing / known (derived, §3).
- No separate "travel situations" mastery model in v1 — topic is a tag on
  sentences/sessions for weighting (§7), not a tracked mastery dimension.

---

## 6. Daily Session Generator

Finite sessions, not an endless feed. A session =
- N sentences pulled for concepts due per FSRS/rollup
- N sentences for concepts still "developing"
- a small number introducing new concepts (respecting novelty budget)
- generated via §4, validated, mixed with any authored sentences still in
  rotation

Session length configurable; default target ~10–15 minutes.

---

## 7. Travel-Topic Weighting

Topics (restaurants, cafés, trains, hotels, directions, convenience
stores, meeting people, asking for clarification, etc.) are a **weighting
input** to the session generator's LLM prompt, not separate courses and
not a separate mastery dimension. A topic weight biases which contexts
generated sentences use, nothing more.

---

## 8. Audio

- TTS generated directly from Japanese text (never from romanization).
- Provider: pick one reliable neural TTS API (Google Cloud TTS, Azure
  Neural, or OpenAI TTS are all reasonable — evaluate cost/quality
  yourself at build time, this is not architecturally load-bearing).
- Cache audio by a hash of the exact sentence text — never regenerate
  identical audio.
- Replay only, manually triggered — no autoplay, no playback-speed control
  (§1: every play is a billed request, so it's never automatic). Selectable
  voice is a nice-to-have, not required for v1.

---

## 9. Offline / Commute Support — v1 vs. v2

**v1 ("commute bundle"):** before a commute, user taps "prepare session."
App pre-fetches the session's sentences, translations, metadata, and TTS
audio into memory/local storage as a self-contained bundle. The session
runs entirely from that bundle regardless of connectivity. Results sync
(review logs pushed to persistent storage) once the session ends —
no background sync, no service-worker cache strategy needed for this.

**Revised when phase 5 was built.** Two clauses above were written before
§16 made decks static JSON and are no longer accurate as specified:

- **Sentences, translations, and metadata need no pre-fetch step of their
  own.** §16 ships them as static deck JSON and §15's segmentation is
  cached in IndexedDB, so they are already local before "prepare" is
  tapped. **TTS audio is the only genuinely network-bound piece**, and it
  is the only thing `prepareBundle()` fetches. It writes through the same
  hash-keyed `audioCache` the player already reads (§8), so a prepared
  session and a naturally-warmed cache are indistinguishable.
- **There is no sync step, and none should be built.** "Results sync once
  the session ends" presumed a remote store; §2 rules out a backend and
  cross-device sync for v1, and review logs are written to IndexedDB at
  answer time. The data is durable the moment it is recorded. Do not add a
  deferred-write queue to satisfy the original wording.

Downloading audio costs money per sentence, so preparing is always a
deliberate user tap that states how many sentences it is about to fetch —
never automatic, and never a silent background top-up. Fetching is
sequential: a parallel burst against a paid API is the quickest way to hit
a rate limit and fail the very sentences the bundle exists to guarantee.

**Deck JSON is cached in IndexedDB (`deckCache`) on every successful
fetch**, and read back when the network is unavailable. Without this the
bundle is lost on reload — audio would still be cached with no sentences
to play it against, which is the failure mode a commute actually produces
(a backgrounded tab gets evicted). The network copy wins whenever it is
reachable, so a redeploy still propagates. This is *not* the deferred v2
service worker: it persists data the app already downloaded into the
database it already uses, and caches no app-shell assets.

**v2 (deferred, do not build unless v1 proves insufficient):** full
PWA offline-first — service worker, IndexedDB-backed asset caching,
background sync on reconnect. Real engineering cost; only justified if
the commute-bundle approach is actually inconvenient in practice.

---

## 10. Progress Tracking

Minimal, non-gamified. Track: concepts encountered, concepts at "known"
status, vocabulary/grammar familiarity aggregates, minutes listened,
sessions completed, travel-topic coverage. No streaks, no leaderboards, no
achievement badges.

---

## 11. Architecture Principle (do not violate)

```
User history
    ↓
Learner model (rollup mastery, derived from review logs)
    ↓
Spaced-repetition scheduler (ts-fsrs on sentences + rollup on concepts)
    ↓
Concepts needing review / new concepts allowed
    ↓
LLM receives constraints (§4)
    ↓
LLM generates natural Japanese sentences (structured JSON)
    ↓
Validator checks output against constraints — regenerate on failure
    ↓
TTS generates/caches audio
    ↓
User completes session
    ↓
Comprehension feedback → ReviewLog
    ↓
Learner model updates
```

Deterministic code owns: persistent state, learning history, mastery
estimates, scheduling, concept selection, session constraints, validation.

The LLM owns: natural sentence generation, phrasing variation,
contextualization. The LLM never decides curriculum or mastery — it only
expresses what the scheduler already decided is needed.

---

## 12. Tech Stack

- Vite + React + TypeScript + Tailwind + shadcn/ui
- Dexie.js (IndexedDB) for all persistent client-side state
- `ts-fsrs` for sentence-level scheduling
- Icons: Lucide (pick one set, don't mix)
- Fonts: Noto Sans JP or Zen Kaku Gothic (Google Fonts) for correct,
  legible Japanese rendering — do not rely on system font fallback
- Furigana: native `<ruby>`/`<rt>` markup; `kuroshiro` if automatic
  furigana generation from raw kanji is needed
- Sentence tokenization/validation: Sudachi, Fugashi, or MeCab (pick one,
  based on whichever has the least friction in the chosen runtime)

---

## 13. Build Order (phases — mostly sequential, see orchestration notes)

| Phase | Scope |
|---|---|
| 0 | Core loop MVP: hardcoded sentence bank, audio-first reveal flow, 4-way feedback, sentence-level ts-fsrs, basic due-based session generator |
| 1 | Concept tagging + rollup mastery scoring |
| 2 | LLM generation (unvalidated) wired to constraint payload |
| 3 | Validator pass (tokenizer-based constraint checking + regenerate loop) |
| 4 | TTS integration + hash-based audio caching |
| 5 | Commute-bundle pre-download/offline-run/sync-on-reconnect — **scope reduced when built; see §9.** Audio is the only thing pre-fetched, and there is no sync-on-reconnect step to build |
| 6 | Travel-topic weighting in the generation prompt |
| — | UI pass (Phase 4-adjacent, see below): Classical design system restyle, dark mode, 3-way rating scale, tap-to-reveal, Study/Browse tab shell (Browse has no functionality yet), Korean as target language, segmented JP↔KO translation (§15) |
| 7 (v2, deferred) | True PWA offline-first: service worker, background sync |
| — | Browse tab (§16): deck library, deck selection scoping the session, saved sentences + saved words as study sets |
| — (future) | Browse: stats, manual segmentation correction, per-deck due counts |

Phases 0–3 are strictly sequential (each depends on the prior phase's
schema/interfaces). Phases 4 and 6 can often run in parallel with each
other or with late parts of phase 3 once the core schema is stable, since
they touch largely disjoint files (audio pipeline vs. prompt weighting).
Phase 5 depends on phases 0 and 4 both being done. Do not parallelize
across a schema boundary — if two slices would both edit the Sentence,
ReviewLog, or ConceptMastery types, they are not independent.

---

## 14. Explicitly Out of Scope for v1

Social features, multiplayer, public profiles, leaderboards, complex
achievements, AI pronunciation scoring, speech-recognition grading, native
iOS/Android app, elaborate cloud infrastructure, cross-device sync,
separate listening/reading mastery axes, per-concept independent FSRS
instances, full PWA offline-first (see §9).

---

## 15. Segmented Japanese ↔ Korean Translation

Added during the Phase 4 UI pass. Purpose: pattern recognition — a learner
should notice the same particle, vocabulary, or construction recurring
across sentences (日本 | に | 行きたい, 学校 | に | 行きたい) and infer the
reusable structure. Consistency across sentences matters more than a
perfectly literal translation of any one sentence.

**The segmented breakdown IS the translation reveal — there is no separate
whole-sentence gloss line shown above it.** Tapping through to the
"translation" stage (§1) shows the aligned segments directly.

**Generation happens at deck-prep time, never during study.** A "Prepare
deck" action (Browse tab) walks every sentence and generates+caches its
segmentation ahead of time — the explicit, deliberate, API-cost-incurring
step, matching the intended workflow (prepared at home on a laptop, before
a commute). The study screen only ever *reads* cached segmentation
(`getSegmentationForDisplay`) — it never calls the LLM. If a sentence
wasn't prepared ahead of time, study falls back instantly to a local
tokenizer-only split (Korean glosses blank) rather than making the learner
wait on a network call mid-session; that fallback is never persisted, so
"Prepare deck" run later still fills it in properly.

**Data model** — a `SentenceSegmentation`, cached by `hashText(japanese)`
(same discipline as `audioCache`, §8: generate once, never regenerate):

```ts
type SegmentType = "vocabulary" | "particle" | "construction" | "other";

type SentenceSegment = {
  japanese: string;
  korean: string;
  type: SegmentType;
  baseForm: string;        // dictionary form
  concepts: string[];      // a construction may map to more than one, e.g. 行きたい → [行く, 〜たい]
};

type SentenceSegmentation = {
  hash: string;             // hashText(japanese)
  japanese: string;
  naturalKorean: string;
  segments: SentenceSegment[];
  createdAt: string;
  source: "llm" | "manual"; // a manual correction is never re-generated over
};
```

Tap-to-save on a segment writes a thin `SavedSegment` pointer (japanese,
baseForm, concepts, sourceSentenceHash) — **not** a parallel scheduling
system. Its concepts roll up through the existing ConceptMastery pipeline
(§3) via ordinary sentence reviews; saving itself never mutates a mastery
score, it's a bookmark for a future Browse-tab review view.

**Generation pipeline:**

```
japanese sentence
  → tokenize() (§12's morphological analyzer — input only, never the final
    segment boundary; kuromoji splits ～たい, ～てもいい etc. into several
    tokens with no signal they're one construction, so the LLM is grounded
    by the tokenization but free to merge tokens into one segment)
  → LLM receives { japanese, naturalKorean, tokens, canonicalGlosses }
  → LLM proposes segments (structured output)
  → deterministic structural validation: segments concatenate back to the
    exact original sentence; no empty japanese/korean/baseForm
  → bounded retry (2 attempts) on validation failure
  → tokenizer-only fallback (one segment per token, Korean left blank) if
    still invalid — never a dead end, always renders something
  → cache in SentenceSegmentation, keyed by hash
```

**Consistency mechanism** (the hard part — an LLM called statelessly on the
same word twice will not reliably repeat its own past choice without help):
before generating, deterministic code looks up any concept in the current
sentence that already has an established Korean gloss from a prior
segmentation (`canonicalGlosses`, same "prior state becomes a prompt
constraint" principle `buildConstraintPayload` already uses in §4) and
tells the LLM to reuse it rather than invent a new phrasing. First-seen
gloss wins; a `source: 'manual'` correction always overrides an LLM one.
Cross-sentence drift is surfaced for manual review (a query grouping saved
segments by `baseForm`), not auto-reconciled.

**§11 boundary:** the LLM owns chunk-boundary judgment and Korean phrasing.
Deterministic code owns caching, the consistency registry, and structural
validation (reconstruction of the original string) — never the linguistic
correctness of a segmentation, which is why validation failures fall back
to a plain tokenizer split rather than being silently "fixed."

---

## 16. Decks as Static JSON — the App is a Reader, Not a Generator

Revised during the Phase 4 UI pass. Decks are authored **outside the app**
and shipped as static, pre-segmented JSON. At runtime the app never
generates sentences and never generates segmentation — it only reads
prepared content. This removes the API key from the study path entirely.

**Layout** — `public/decks/index.json` is a manifest (a static host can't
list a directory), pointing at one JSON file per deck:

```json
{ "decks": ["example.json"] }
```

Each deck file is self-contained, with segments inline per sentence:

```json
{
  "id": "example",
  "name": "Everyday Japanese",
  "sentences": [
    {
      "id": "ex-1",
      "japanese": "京都に行きたいです。",
      "translation": "교토에 가고 싶어요.",
      "concepts": ["京都", "に", "行く", "〜たい"],
      "topic": "trains",
      "segments": [ /* SentenceSegment[] — see §15 */ ]
    }
  ]
}
```

On load, `src/lib/deckStore.ts` splits each entry into a `Sentence` record
and seeds a `SentenceSegmentation` row keyed by `hashText(japanese)`, so
§15's existing cache-first read path finds it unchanged. Existing rows are
never overwritten, so a manual correction survives a redeploy.

**Consequences:**
- In-app sentence generation (the ✨ control) is removed from the study
  screen. §4's generation pipeline and §15's segmentation pipeline remain in
  the codebase as the basis for the external deck-prep tool, but nothing in
  the runtime calls them.
- "Prepare deck" is gone from Browse for the same reason.
- Adding a deck = drop a JSON file in `public/decks/` and add it to the
  manifest. No backend, so §2's client-side-only rule still holds.

**Browse as a deck library.** Browse lists every deck from the manifest plus
two saved sets, and selecting any of them sets the **study source**, which
scopes the next session:

```ts
type StudySource =
  | { kind: 'deck'; deckId: string }
  | { kind: 'saved-sentences' }
  | { kind: 'saved-words' }
```

Persisted in `settings` (via `src/lib/studySource.ts`) so the choice survives
a reload; `generateSession(source)` resolves it to sentence ids before the
existing due/unseen/not-due ordering runs. Saved words resolve back to their
source sentences by hashing each sentence and matching `sourceSentenceHash`
— the same `hashText` the segmentation cache is keyed by.

Two ways to collect:
- **Saved sentences** — a star on the study card (`savedSentences` table)
- **Saved words** — tapping a segment after reveal (§15's `savedSegments`)

Both are toggles, and both are bookmarks only: neither mutates mastery
scores, which still come solely from ordinary sentence reviews (§3).
An empty saved set is shown disabled rather than opening an empty session.

**Still future:** stats, manual segmentation correction, and per-deck due
counts in the deck cards.
