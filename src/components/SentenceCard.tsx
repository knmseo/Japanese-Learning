import { Ear, FastForward, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Comprehension, RevealStage, Sentence } from '@/lib/types'
import { useSpeech } from '@/lib/useSpeech'

type Props = {
  sentence: Sentence
  onAnswer: (comprehension: Comprehension, revealStage: RevealStage, responseLatencyMs: number) => void
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25] as const
const REVEAL_STAGES: RevealStage[] = ['audio_only', 'jp_text', 'translation']
const SWIPE_THRESHOLD_PX = 50

export function SentenceCard({ sentence, onAnswer }: Props) {
  const [stageIndex, setStageIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [revealedAt] = useState(() => Date.now())
  const { speak, autoplay: autoplaySpeak, isSpeaking } = useSpeech()
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const speed = PLAYBACK_SPEEDS[speedIndex]
  const revealStage = REVEAL_STAGES[stageIndex]

  useEffect(() => {
    setStageIndex(0)
    if (autoplay) autoplaySpeak(sentence.japanese, speed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence.id])

  const handleAnswer = (comprehension: Comprehension) => {
    onAnswer(comprehension, revealStage, Date.now() - revealedAt)
  }

  const advanceStage = () => setStageIndex((i) => Math.min(i + 1, REVEAL_STAGES.length - 1))
  const retreatStage = () => setStageIndex((i) => Math.max(i - 1, 0))

  const handlePointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!swipeStart.current) return
    const dx = e.clientX - swipeStart.current.x
    const dy = e.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) advanceStage()
    else retreatStage()
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Card
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
        className="touch-pan-y select-none"
      >
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Button
            size="lg"
            variant={isSpeaking ? 'secondary' : 'default'}
            className="h-16 w-16 rounded-full"
            onClick={() => speak(sentence.japanese, speed)}
            aria-label="Play audio"
          >
            <Play className="size-6" />
          </Button>

          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <button
              type="button"
              className="flex items-center gap-1 underline-offset-2 hover:underline"
              onClick={() => setSpeedIndex((i) => (i + 1) % PLAYBACK_SPEEDS.length)}
            >
              <FastForward className="size-3.5" />
              {speed}x
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              className="flex items-center gap-1 underline-offset-2 hover:underline"
              onClick={() => setAutoplay((v) => !v)}
            >
              <Ear className="size-3.5" />
              autoplay {autoplay ? 'on' : 'off'}
            </button>
          </div>

          <div className="mt-2 min-h-16 text-center">
            {stageIndex >= 1 ? (
              <p className="font-medium text-2xl">{sentence.japanese}</p>
            ) : (
              <Button variant="outline" onClick={advanceStage}>
                Show Japanese text
              </Button>
            )}
          </div>

          <div className="min-h-12 text-center">
            {stageIndex >= 1 &&
              (stageIndex >= 2 ? (
                <p className="text-muted-foreground">{sentence.translation}</p>
              ) : (
                <Button variant="ghost" size="sm" onClick={advanceStage}>
                  Show translation
                </Button>
              ))}
          </div>

          <p className="text-muted-foreground text-xs">Swipe left to reveal, right to hide</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => handleAnswer(1)}>
          Understood immediately
        </Button>
        <Button variant="outline" onClick={() => handleAnswer(2)}>
          Needed Japanese text
        </Button>
        <Button variant="outline" onClick={() => handleAnswer(3)}>
          Needed translation
        </Button>
        <Button variant="outline" onClick={() => handleAnswer(4)}>
          Did not understand
        </Button>
      </div>
    </div>
  )
}
