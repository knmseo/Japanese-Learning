import { useEffect, useState } from 'react'
import { BrowseScreen } from '@/components/BrowseScreen'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { OfflineBundleControl } from '@/components/OfflineBundleControl'
import { ScreenToggle } from '@/components/ScreenToggle'
import { SentenceCard } from '@/components/SentenceCard'
import { updateConceptsForReview } from '@/lib/conceptMastery'
import { db } from '@/lib/db'
import { getDecks } from '@/lib/deckStore'
import { generateId } from '@/lib/id'
import { comprehensionToFsrsRating, scheduleNext } from '@/lib/scheduler'
import { getAllSentences } from '@/lib/sentenceStore'
import { generateSession } from '@/lib/sessionGenerator'
import { describeStudySource, getStudySource, setStudySource } from '@/lib/studySource'
import { getThemeVars } from '@/lib/theme'
import type { Comprehension, RevealStage, Sentence, StudySource } from '@/lib/types'

type Screen = 'study' | 'browse'

function App() {
  const [screen, setScreen] = useState<Screen>('study')
  const [sentenceIds, setSentenceIds] = useState<string[] | null>(null)
  const [sentenceById, setSentenceById] = useState<Map<string, Sentence>>(new Map())
  const [sourceLabel, setSourceLabel] = useState<string>('')
  const [studySource, setStudySourceState] = useState<StudySource | null>(null)
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [dark, setDark] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      // Fall back to the first deck the very first time, before anything has been picked.
      const decks = await getDecks().catch(() => [])
      const stored = await getStudySource()
      const source = stored ?? (decks[0] ? ({ kind: 'deck', deckId: decks[0].id } as StudySource) : null)
      await startSession(source)
    })()
  }, [])

  async function startSession(source: StudySource | null) {
    setCompleted(false)
    setIndex(0)
    setLoadError(null)
    setStudySourceState(source)
    try {
      const [sentences, decks] = await Promise.all([getAllSentences(), getDecks()])
      setSentenceById(new Map(sentences.map((s) => [s.id, s])))
      const deckName = source?.kind === 'deck' ? decks.find((d) => d.id === source.deckId)?.name : undefined
      setSourceLabel(source ? describeStudySource(source, deckName) : '')
      setSentenceIds(await generateSession(source))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
      setSentenceIds([])
    }
  }

  /** Browse picked a deck or saved set — persist it and rebuild the session in the background.
   * Stays on the Browse screen (item 3): the next Study visit just shows the new session. */
  async function handleSelectSource(source: StudySource) {
    await setStudySource(source)
    await startSession(source)
  }

  async function handleAnswer(comprehension: Comprehension, revealStage: RevealStage, responseLatencyMs: number) {
    if (!sentenceIds) return
    const sentenceId = sentenceIds[index]
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

    if (index + 1 >= sentenceIds.length) {
      setCompleted(true)
    } else {
      setIndex(index + 1)
    }
  }

  const themeVars = getThemeVars(dark)
  const sentence = sentenceIds ? sentenceById.get(sentenceIds[index]) : undefined
  /** The whole session, for §9's commute bundle — not just the current card. */
  const sessionSentences = (sentenceIds ?? [])
    .map((id) => sentenceById.get(id))
    .filter((s): s is Sentence => !!s)

  let studyContent: React.ReactNode
  if (loadError) {
    studyContent = (
      <div className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-destructive text-sm">Couldn't load decks: {loadError}</p>
      </div>
    )
  } else if (!sentenceIds) {
    studyContent = (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[var(--color-neutral-500)]">Loading session…</p>
      </div>
    )
  } else if (sentenceIds.length === 0) {
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
  } else if (completed) {
    studyContent = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--color-accent-500)" strokeWidth="1.4" />
          <path
            d="M8 12.5l2.7 2.7L16 9.5"
            stroke="var(--color-accent-700)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1
          className="text-2xl"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' as unknown as number }}
        >
          Session complete
        </h1>
        <p className="text-[var(--color-neutral-500)] text-sm">You reviewed {sentenceIds.length} sentences.</p>
        <button
          type="button"
          onClick={() => void startSession(studySource)}
          className="btn btn-secondary"
          style={{ borderColor: '#312F2A' }}
        >
          Start another session
        </button>
      </div>
    )
  } else if (sentence) {
    studyContent = (
      <div className="flex flex-1 flex-col items-center px-4 pt-6">
        <div className="flex w-full max-w-md items-start justify-between">
          <div>
            <p
              className="text-[11px] uppercase"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.08em' }}
            >
              Study
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--color-neutral-500)] tabular-nums">
              {index + 1} / {sentenceIds.length}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <DarkModeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
            <OfflineBundleControl sentences={sessionSentences} />
          </div>
        </div>

        {sourceLabel && (
          <p
            className="mt-5 mb-3 text-[17px]"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--color-text)' }}
          >
            {sourceLabel}
          </p>
        )}

        <SentenceCard key={sentence.id} sentence={sentence} onAnswer={handleAnswer} />
      </div>
    )
  }

  const SLIDE_TRANSITION = 'transform 420ms var(--ease-damped)'

  return (
    <main className="classical flex min-h-svh flex-col bg-[var(--color-bg)] text-[var(--color-text)]" style={themeVars}>
      {/* Both screens stay mounted — switching tabs must not reset reveal state or re-fire
          autoplay. Sliding via `transform` (rather than the old display:none/flex swap) is
          what makes the transition animatable; overflow-hidden on the wrapper is what keeps
          the off-screen pane from creating a horizontal scrollbar. */}
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
