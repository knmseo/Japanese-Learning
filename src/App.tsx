import { useEffect, useState } from 'react'
import { BrowseScreen } from '@/components/BrowseScreen'
import { PressableButton } from '@/components/PressableButton'
import { OfflineBundleControl } from '@/components/OfflineBundleControl'
import { ScreenToggle } from '@/components/ScreenToggle'
import { SentenceCard } from '@/components/SentenceCard'
import { consumeInviteFromUrl } from '@/lib/accessToken'
import { updateConceptsForReview } from '@/lib/conceptMastery'
import { db } from '@/lib/db'
import { getDecks } from '@/lib/deckStore'
import { generateId } from '@/lib/id'
import { comprehensionToFsrsRating, scheduleNext } from '@/lib/scheduler'
import { getAllSentences } from '@/lib/sentenceStore'
import { generateSession } from '@/lib/sessionGenerator'
import { completeSessionRecord, recordSessionProgress, startSessionRecord } from '@/lib/sessionLog'
import { describeStudySource, getStudySource, setStudySource } from '@/lib/studySource'
import { getThemeVars } from '@/lib/theme'
import type { Comprehension, RevealStage, Sentence, StudySource } from '@/lib/types'

type Screen = 'study' | 'browse'

/** The mockup draws no empty, complete or error screen, so these reuse the one
 * button shape it does specify — the rating pill from `StudyTab - Translation`
 * (1.5px ink outline, 24px radius, 4px slab) — rather than inventing a
 * second button language. */
const PILL_STYLE: React.CSSProperties = {
  height: 48,
  paddingInline: 26,
  background: 'var(--color-surface)',
  border: '1.5px solid var(--color-shadow)',
  borderRadius: 'var(--radius-pill)',
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  fontSize: 18,
  color: 'var(--color-text)',
}

/** Kaisei Tokumin Bold, matching the STUDY/BROWSE eyebrows and Settings headings. */
const SCREEN_TITLE: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 'var(--font-heading-weight)' as unknown as number,
  fontSize: 22,
  color: 'var(--color-text)',
}

function App() {
  const [screen, setScreen] = useState<Screen>('study')
  const [sentenceIds, setSentenceIds] = useState<string[] | null>(null)
  const [sentenceById, setSentenceById] = useState<Map<string, Sentence>>(new Map())
  const [sourceLabel, setSourceLabel] = useState<string>('')
  const [studySource, setStudySourceState] = useState<StudySource | null>(null)
  /** How many cards have been rated this session — `sentenceIds[answeredCount]`
   * is always the current live/unrated card. Advances only via a rating. */
  const [answeredCount, setAnsweredCount] = useState(0)
  /** Which card is on screen. Starts equal to answeredCount and tracks it
   * forward after each rating; swipe can move it back to review an already-
   * rated card (viewOnly) or forward again, but never past answeredCount —
   * rating is the only way to advance the live frontier. */
  const [viewIndex, setViewIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  /** Row id in `sessions` for the run in progress (§10), null for an empty session. */
  const [sessionId, setSessionId] = useState<string | null>(null)
  /** Earliest upcoming review in this source — shown when nothing is due yet. */
  const [nextDueAt, setNextDueAt] = useState<string | null>(null)
  /** Light-only for now: the dark-mode toggle was pulled pending a designed dark
   * theme (the Figma file has no dark frames). The palette and getThemeVars()
   * still carry a full dark set, so re-adding the control is the only step
   * needed to bring it back — see src/components/DarkModeToggle.tsx, which is
   * kept for that purpose. */
  const dark = false
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      // Before anything can ask for audio, so a fresh invite link works on the
      // very first sentence rather than only after a reload.
      await consumeInviteFromUrl()
      // Fall back to the first deck the very first time, before anything has been picked.
      const decks = await getDecks().catch(() => [])
      const stored = await getStudySource()
      const source = stored ?? (decks[0] ? ({ kind: 'deck', deckId: decks[0].id } as StudySource) : null)
      await startSession(source)
    })()
  }, [])

  async function startSession(source: StudySource | null, studyAhead = false) {
    setCompleted(false)
    setAnsweredCount(0)
    setViewIndex(0)
    setLoadError(null)
    setStudySourceState(source)
    try {
      const [sentences, decks] = await Promise.all([getAllSentences(), getDecks()])
      setSentenceById(new Map(sentences.map((s) => [s.id, s])))
      const deckName = source?.kind === 'deck' ? decks.find((d) => d.id === source.deckId)?.name : undefined
      setSourceLabel(source ? describeStudySource(source, deckName) : '')
      const plan = await generateSession(source, new Date(), undefined, undefined, studyAhead)
      setSentenceIds(plan.sentenceIds)
      setNextDueAt(plan.nextDueAt)
      // The `sessions` row is created lazily on the first answer, not here —
      // otherwise merely browsing decks (or StrictMode's double-invoked effect
      // in dev) would log sessions that were never studied.
      setSessionId(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
      setSentenceIds([])
    }
  }

  /** Browse picked a deck or saved set — persist it and rebuild the session in the background.
   * Stays on the Browse screen (item 3): the next Study visit just shows the new session. */
  async function handleSelectSource(source: StudySource) {
    // Flip the selection synchronously, before any await: the deck card reads
    // its pressed state off this, and awaiting the IndexedDB write first left
    // the card visibly un-pressed for a frame after the tap. Persisting and
    // rebuilding the session then happen behind the already-updated UI.
    setStudySourceState(source)
    await setStudySource(source)
    await startSession(source)
  }

  async function handleAnswer(comprehension: Comprehension, revealStage: RevealStage, responseLatencyMs: number) {
    if (!sentenceIds) return
    // Rating only ever applies to the live card — the current answeredCount
    // index — regardless of which card is on screen (swipe-back leaves
    // rating buttons hidden, but this guard is the defensive backstop).
    if (viewIndex !== answeredCount) return
    const sentenceId = sentenceIds[answeredCount]
    const sentence = sentenceById.get(sentenceId)
    const now = new Date()

    const fsrsRating = comprehensionToFsrsRating(comprehension)
    const currentState = await db.fsrsStates.get(sentenceId)
    const nextState = scheduleNext(sentenceId, currentState, fsrsRating, now)

    await db.reviewLogs.add({
      id: generateId(),
      sentenceId,
      timestamp: now.toISOString(),
      revealStage,
      comprehension,
      responseLatencyMs,
      fsrsRating,
    })
    await db.fsrsStates.put(nextState)
    if (sentence) await updateConceptsForReview(sentence.concepts, fsrsRating, now)

    // First answer of this run — open its `sessions` row now (§10).
    let activeSessionId = sessionId
    if (!activeSessionId) {
      activeSessionId = await startSessionRecord(sentenceIds)
      setSessionId(activeSessionId)
    }

    const next = answeredCount + 1
    setAnsweredCount(next)
    void recordSessionProgress(activeSessionId, next)
    if (next >= sentenceIds.length) {
      setCompleted(true)
      void completeSessionRecord(activeSessionId)
    } else {
      setViewIndex(next)
    }
  }

  /** Swipe navigates among already-rated cards plus the current live one —
   * never past it, since rating is the only way to advance the frontier. */
  function handleSwipe(direction: 'next' | 'previous') {
    if (direction === 'next') {
      setViewIndex((v) => Math.min(answeredCount, v + 1))
    } else {
      setViewIndex((v) => Math.max(0, v - 1))
    }
  }

  const themeVars = getThemeVars(dark)
  const sentence = sentenceIds ? sentenceById.get(sentenceIds[viewIndex]) : undefined
  const viewOnly = viewIndex < answeredCount
  /** The whole session, for §9's commute bundle — not just the current card. */
  const sessionSentences = (sentenceIds ?? [])
    .map((id) => sentenceById.get(id))
    .filter((s): s is Sentence => !!s)

  let studyContent: React.ReactNode
  if (loadError) {
    studyContent = (
      <div className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm" style={{ color: 'var(--color-error)', fontFamily: 'var(--font-body)' }}>
          Couldn't load decks: {loadError}
        </p>
      </div>
    )
  } else if (!sentenceIds) {
    studyContent = (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[var(--color-neutral-500)]">Loading session…</p>
      </div>
    )
  } else if (sentenceIds.length === 0 && !nextDueAt) {
    studyContent = (
      <div className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-[var(--color-neutral-500)]">
          {studySource?.kind === 'saved-sentences'
            ? "You haven't starred any sentences yet."
            : studySource?.kind === 'saved-words'
              ? "You haven't saved any words yet — tap one after revealing a translation."
              : 'No sentences available.'}
        </p>
      </div>
    )
  } else if (sentenceIds.length === 0) {
    // Nothing is due and there is no new material — the scheduler has genuinely
    // deferred everything. Saying so beats silently re-drilling cards that FSRS
    // put days out, which is what padding the session used to do.
    const days = nextDueAt
      ? Math.max(0, Math.ceil((new Date(nextDueAt).getTime() - Date.now()) / 86400000))
      : null
    studyContent = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 style={SCREEN_TITLE}>Nothing due yet</h1>
        <p className="max-w-xs text-[14px]" style={{ color: 'var(--color-neutral-500)' }}>
          {days === null
            ? 'This set is fully reviewed.'
            : days === 0
              ? 'The next review comes up later today.'
              : `The next review is in ${days} ${days === 1 ? 'day' : 'days'}.`}{' '}
          Spacing the gaps out is what makes it stick.
        </p>
        <PressableButton
          type="button"
          onClick={() => void startSession(studySource, true)}
          className="flex items-center justify-center"
          restDepthPx={4}
          shadowColor="var(--color-shadow)"
          style={PILL_STYLE}
        >
          Study ahead anyway
        </PressableButton>
      </div>
    )
  } else if (completed) {
    studyContent = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--color-accent-500)" strokeWidth="1.6" />
          <path
            d="M8 12.5l2.7 2.7L16 9.5"
            stroke="var(--color-accent-700)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 style={SCREEN_TITLE}>Session complete</h1>
        <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>
          You reviewed {sentenceIds.length} sentences.
        </p>
        <PressableButton
          type="button"
          onClick={() => void startSession(studySource)}
          className="flex items-center justify-center"
          restDepthPx={4}
          shadowColor="var(--color-shadow)"
          style={PILL_STYLE}
        >
          Start another session
        </PressableButton>
      </div>
    )
  } else if (sentence) {
    studyContent = (
      // The mockup's frame is 402 wide with the header inset 24 and the card 41,
      // so the column caps at 402 and the card sets its own narrower width.
      <div className="flex flex-1 flex-col items-center px-4 pt-6">
        <div className="flex w-full max-w-[402px] items-start justify-between px-5">
          <div>
            <p
              className="uppercase"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 'var(--font-heading-weight)' as unknown as number,
                fontSize: 18,
                color: 'var(--color-text)',
              }}
            >
              Study
            </p>
            <p
              className="tabular-nums"
              style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-neutral-600)' }}
            >
              {viewIndex + 1} / {sentenceIds.length}
              {viewOnly && ' · reviewing'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <OfflineBundleControl sentences={sessionSentences} />
          </div>
        </div>

        {sourceLabel && (
          // Deck name — Kaisei Tokumin Medium 18, centred, ~51px below the
          // counter and ~18px above the card (frame positions 119 → 189 → 233).
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              fontSize: 18,
              color: 'var(--color-text)',
              marginTop: 44,
              marginBottom: 18,
            }}
          >
            {sourceLabel}
          </p>
        )}

        <SentenceCard
          key={sentence.id}
          sentence={sentence}
          viewOnly={viewOnly}
          onAnswer={handleAnswer}
          onSwipe={handleSwipe}
        />
      </div>
    )
  }

  const SLIDE_TRANSITION = 'transform 420ms var(--ease-damped)'

  return (
    <main className="classical flex min-h-svh flex-col bg-[var(--color-bg)] text-[var(--color-text)]" style={themeVars}>
      {/* Both screens stay mounted — switching tabs must not reset reveal state. Sliding
          via `transform` (rather than the old display:none/flex swap) is what makes the
          transition animatable; overflow-hidden on the wrapper is what keeps the off-screen
          pane from creating a horizontal scrollbar. */}
      <div className="relative flex flex-1 overflow-hidden">
        <div
          className="absolute inset-0 flex flex-col"
          style={{ transform: screen === 'study' ? 'translateX(0%)' : 'translateX(-100%)', transition: SLIDE_TRANSITION }}
          inert={screen !== 'study'}
        >
          {studyContent}
        </div>
        <div
          className="absolute inset-0 flex flex-col"
          style={{ transform: screen === 'browse' ? 'translateX(0%)' : 'translateX(100%)', transition: SLIDE_TRANSITION }}
          inert={screen !== 'browse'}
        >
          <BrowseScreen
            visible={screen === 'browse'}
            activeSource={studySource}
            onSelectSource={(source) => void handleSelectSource(source)}
          />
        </div>
      </div>
      <ScreenToggle screen={screen} onChange={setScreen} />
    </main>
  )
}

export default App
