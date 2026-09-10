import { Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiKeyCard } from '@/components/ApiKeyCard'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { SentenceCard } from '@/components/SentenceCard'
import { TabBar } from '@/components/TabBar'
import { getApiKey, setApiKey } from '@/lib/apiKey'
import { updateConceptsForReview } from '@/lib/conceptMastery'
import { buildConstraintPayload } from '@/lib/constraintPayload'
import { db } from '@/lib/db'
import { generateId } from '@/lib/id'
import { comprehensionToFsrsRating, scheduleNext } from '@/lib/scheduler'
import { generateValidatedSentence } from '@/lib/sentenceGenerator'
import { getAllSentences, saveGeneratedSentence } from '@/lib/sentenceStore'
import { generateSession } from '@/lib/sessionGenerator'
import { getThemeVars } from '@/lib/theme'
import type { Comprehension, ConstraintPayload, RevealStage, Sentence } from '@/lib/types'

type Screen = 'study' | 'browse'

function App() {
  const [screen, setScreen] = useState<Screen>('study')
  const [sentenceIds, setSentenceIds] = useState<string[] | null>(null)
  const [sentenceById, setSentenceById] = useState<Map<string, Sentence>>(new Map())
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [dark, setDark] = useState(false)

  const [isGenerating, setIsGenerating] = useState(false)
  const [needsKey, setNeedsKey] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<ConstraintPayload | null>(null)

  useEffect(() => {
    void startSession()
  }, [])

  async function startSession() {
    setCompleted(false)
    setIndex(0)
    setGenError(null)
    setLastPayload(null)
    const sentences = await getAllSentences()
    setSentenceById(new Map(sentences.map((s) => [s.id, s])))
    setSentenceIds(await generateSession())
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

    setGenError(null)
    setLastPayload(null)

    if (index + 1 >= sentenceIds.length) {
      setCompleted(true)
    } else {
      setIndex(index + 1)
    }
  }

  /** Generates one sentence from the constraint payload and jumps straight to it. */
  async function handleGenerate() {
    if (!sentenceIds) return
    if (!(await getApiKey())) {
      setNeedsKey(true)
      return
    }

    setIsGenerating(true)
    setGenError(null)
    try {
      const payload = await buildConstraintPayload()
      const result = await generateValidatedSentence(payload)

      if (result.status === 'rejected') {
        setGenError(
          `Couldn't produce a sentence inside the novelty budget after ${result.attempts} attempts (kept introducing: ${result.newTokens.join('、')}). Sticking with the authored sentences.`,
        )
        return
      }

      const generated = result.sentence
      const sentence: Sentence = {
        id: generateId(),
        japanese: generated.japanese,
        translation: generated.translation,
        concepts: generated.concepts,
        source: 'generated',
        createdAt: new Date().toISOString(),
      }
      await saveGeneratedSentence(sentence)

      setSentenceById((prev) => new Map(prev).set(sentence.id, sentence))
      setSentenceIds((prev) => {
        if (!prev) return prev
        const next = [...prev]
        next.splice(index + 1, 0, sentence.id)
        return next
      })
      setLastPayload(payload)
      setCompleted(false)
      setIndex(index + 1)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsGenerating(false)
    }
  }

  const themeVars = getThemeVars(dark)

  let content: React.ReactNode
  if (screen === 'browse') {
    content = (
      <div className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-[var(--color-neutral-500)] text-sm">Browse is coming in a future update.</p>
      </div>
    )
  } else if (!sentenceIds) {
    content = (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[var(--color-neutral-500)]">Loading session…</p>
      </div>
    )
  } else if (sentenceIds.length === 0) {
    content = (
      <div className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-[var(--color-neutral-500)]">No sentences available.</p>
      </div>
    )
  } else if (completed) {
    content = (
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
          onClick={() => void startSession()}
          className="btn btn-secondary"
          style={{ borderColor: '#312F2A' }}
        >
          Start another session
        </button>
      </div>
    )
  } else {
    const sentence = sentenceById.get(sentenceIds[index])
    content = sentence ? (
      <div className="flex flex-1 flex-col items-center gap-4 px-4 py-8">
        <div className="flex w-full max-w-md items-center justify-between pt-2">
          <p className="font-[var(--font-body)] text-[13px] text-[var(--color-neutral-500)] tabular-nums">
            {index + 1} / {sentenceIds.length}
            {sentence.source === 'generated' && <span className="ml-2 text-[11px]">generated</span>}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating}
              aria-label="Generate a new sentence"
              className="flex size-8 items-center justify-center text-[var(--color-accent-700)] disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            </button>
            <DarkModeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
          </div>
        </div>

        {needsKey && (
          <ApiKeyCard
            providerLabel="Anthropic"
            envVarName="VITE_ANTHROPIC_API_KEY"
            placeholder="sk-ant-..."
            onSave={setApiKey}
            onSaved={() => {
              setNeedsKey(false)
              void handleGenerate()
            }}
            onCancel={() => setNeedsKey(false)}
          />
        )}

        {genError && <p className="w-full max-w-md text-destructive text-sm">{genError}</p>}

        <SentenceCard key={sentence.id} sentence={sentence} onAnswer={handleAnswer} />

        {lastPayload && sentence.source === 'generated' && (
          <details className="w-full max-w-md text-[11px] text-[var(--color-neutral-500)]">
            <summary className="cursor-pointer">
              Built from {lastPayload.knownConcepts.length} known · {lastPayload.developingConcepts.length} developing ·{' '}
              {lastPayload.conceptsDueForReview.length} due
            </summary>
            <pre className="mt-2 overflow-x-auto">{JSON.stringify(lastPayload, null, 2)}</pre>
          </details>
        )}
      </div>
    ) : null
  }

  return (
    <main className="classical flex min-h-svh flex-col bg-[var(--color-bg)] text-[var(--color-text)]" style={themeVars}>
      {content}
      <TabBar screen={screen} onChange={setScreen} />
    </main>
  )
}

export default App
