# Japanese Sentence-Acquisition App — SPEC.md

Personal-use, mobile-first PWA for Japanese acquisition via listening,
sentence-based comprehension, and adaptive spaced repetition. Single user.
Not social, not gamified — no leaderboards, XP, streak mechanics.

This file is the source of truth for architecture and scope. If an
implementation decision isn't here, ask before inventing one.

---

## 1. Core Learning Loop

- One sentence at a time, audio-first.
- Order of reveal: audio → (optional) Japanese text → (optional) translation.
  Translation hidden by default. Optional furigana on kanji.
- Instant replay, autoplay toggle, playback-speed control.
- Mobile-first controls: swipe or tap for next/previous. Built for
  one-handed use while commuting.
- After each sentence, four comprehension responses:
  1. Understood immediately
  2. Understood after seeing Japanese text
  3. Understood after seeing translation
  4. Did not understand

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
};

type ReviewLog = {
  id: string;
  sentenceId: string;
  timestamp: string;
  revealStage: "audio_only" | "jp_text" | "translation"; // how far user needed to go
  comprehension: 1 | 2 | 3 | 4;   // maps to the four buttons above
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
```

Storage: **Dexie.js** over IndexedDB, client-side only for v1. No backend,
no cross-device sync in v1.

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
- Replay, autoplay toggle, playback-speed control. Selectable voice is a
  nice-to-have, not required for v1.

---

## 9. Offline / Commute Support — v1 vs. v2

**v1 ("commute bundle"):** before a commute, user taps "prepare session."
App pre-fetches the session's sentences, translations, metadata, and TTS
audio into memory/local storage as a self-contained bundle. The session
runs entirely from that bundle regardless of connectivity. Results sync
(review logs pushed to persistent storage) once the session ends —
no background sync, no service-worker cache strategy needed for this.

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
| 5 | Commute-bundle pre-download/offline-run/sync-on-reconnect |
| 6 | Travel-topic weighting in the generation prompt |
| 7 (v2, deferred) | True PWA offline-first: service worker, background sync |

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
