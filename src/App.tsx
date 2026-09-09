import { useEffect, useState } from 'react'
import { SentenceCard } from '@/components/SentenceCard'
import { Button } from '@/components/ui/button'
import { sentenceBank } from '@/data/sentences'
import { db } from '@/lib/db'
import { generateSession } from '@/lib/sessionGenerator'
import { comprehensionToFsrsRating, scheduleNext } from '@/lib/scheduler'
import type { Comprehension, RevealStage } from '@/lib/types'

const sentenceById = new Map(sentenceBank.map((s) => [s.id, s]))

function App() {
  const [sentenceIds, setSentenceIds] = useState<string[] | null>(null)
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    void startSession()
  }, [])

  async function startSession() {
    setCompleted(false)
    setIndex(0)
    const ids = await generateSession()
    setSentenceIds(ids)
  }

  async function handleAnswer(comprehension: Comprehension, revealStage: RevealStage, responseLatencyMs: number) {
    if (!sentenceIds) return
    const sentenceId = sentenceIds[index]
    const now = new Date()

    const fsrsRating = comprehensionToFsrsRating(comprehension)
    const currentState = await db.fsrsStates.get(sentenceId)
    const nextState = scheduleNext(sentenceId, currentState, fsrsRating, now)

    await db.reviewLogs.add({
      id: crypto.randomUUID(),
      sentenceId,
      timestamp: now.toISOString(),
      revealStage,
      comprehension,
      responseLatencyMs,
      fsrsRating,
    })
    await db.fsrsStates.put(nextState)

    if (index + 1 >= sentenceIds.length) {
      setCompleted(true)
    } else {
      setIndex(index + 1)
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
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-8">
      <p className="text-muted-foreground text-sm">
        {index + 1} / {sentenceIds.length}
      </p>
      <SentenceCard key={sentence.id} sentence={sentence} onAnswer={handleAnswer} />
    </main>
  )
}

export default App
