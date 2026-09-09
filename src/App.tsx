import { Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiKeyCard } from '@/components/ApiKeyCard'
import { SentenceCard } from '@/components/SentenceCard'
import { Button } from '@/components/ui/button'
import { getApiKey } from '@/lib/apiKey'
import { updateConceptsForReview } from '@/lib/conceptMastery'
import { buildConstraintPayload } from '@/lib/constraintPayload'
import { db } from '@/lib/db'
import { generateId } from '@/lib/id'
import { comprehensionToFsrsRating, scheduleNext } from '@/lib/scheduler'
import { generateSentence } from '@/lib/sentenceGenerator'
import { getAllSentences, saveGeneratedSentence } from '@/lib/sentenceStore'
import { generateSession } from '@/lib/sessionGenerator'
import type { Comprehension, ConstraintPayload, RevealStage, Sentence } from '@/lib/types'

function App() {
  const [sentenceIds, setSentenceIds] = useState<string[] | null>(null)
  const [sentenceById, setSentenceById] = useState<Map<string, Sentence>>(new Map())
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(false)

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
      const generated = await generateSentence(payload)

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

  if (!sentenceIds) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading session…</p>
      </main>
    )
  }

  if (sentenceIds.length === 0) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4 text-center">
        <p className="text-muted-foreground">No sentences available.</p>
      </main>
    )
  }

  if (completed) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-semibold text-2xl">Session complete</h1>
        <p className="text-muted-foreground">You reviewed {sentenceIds.length} sentences.</p>
        <Button onClick={() => void startSession()}>Start another session</Button>
      </main>
    )
  }

  const sentence = sentenceById.get(sentenceIds[index])
  if (!sentence) return null

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 py-8">
      <div className="flex w-full max-w-md items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {index + 1} / {sentenceIds.length}
          {sentence.source === 'generated' && <span className="ml-2 text-xs">generated</span>}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          aria-label="Generate a new sentence"
        >
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        </Button>
      </div>

      {needsKey && (
        <ApiKeyCard
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
        <details className="w-full max-w-md text-muted-foreground text-xs">
          <summary className="cursor-pointer">
            Built from {lastPayload.knownConcepts.length} known · {lastPayload.developingConcepts.length} developing ·{' '}
            {lastPayload.conceptsDueForReview.length} due
          </summary>
          <pre className="mt-2 overflow-x-auto">{JSON.stringify(lastPayload, null, 2)}</pre>
        </details>
      )}
    </main>
  )
}

export default App
