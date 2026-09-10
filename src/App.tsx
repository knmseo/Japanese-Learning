import { useEffect, useState } from 'react'
import { BrowseScreen } from '@/components/BrowseScreen'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { SentenceCard } from '@/components/SentenceCard'
import { TabBar } from '@/components/TabBar'
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

  /** Browse picked a deck or saved set — persist it, rebuild the session, and jump to Study. */
  async function handleSelectSource(source: StudySource) {
    await setStudySource(source)
    setScreen('study')
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
          <DarkModeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
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

  return (
    <main className="classical flex min-h-svh flex-col bg-[var(--color-bg)] text-[var(--color-text)]" style={themeVars}>
      {/* Both screens stay mounted — switching tabs must not reset reveal state or re-fire autoplay. */}
      <div className={screen === 'study' ? 'flex flex-1 flex-col' : 'hidden'}>{studyContent}</div>
      <div className={screen === 'browse' ? 'flex flex-1 flex-col' : 'hidden'}>
        <BrowseScreen
          visible={screen === 'browse'}
          activeSource={studySource}
          onSelectSource={(source) => void handleSelectSource(source)}
        />
      </div>
      <TabBar screen={screen} onChange={setScreen} />
    </main>
  )
}

export default App
