import { Ear, FastForward, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Comprehension, RevealStage, Sentence } from '@/lib/types'
import { useSpeech } from '@/lib/useSpeech'

type Props = {
  sentence: Sentence
  onAnswer: (comprehension: Comprehension, revealStage: RevealStage, responseLatencyMs: number) => void
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25] as const

export function SentenceCard({ sentence, onAnswer }: Props) {
  const [showJapanese, setShowJapanese] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [revealedAt] = useState(() => Date.now())
  const { speak, isSpeaking } = useSpeech()

  const speed = PLAYBACK_SPEEDS[speedIndex]

  useEffect(() => {
    setShowJapanese(false)
    setShowTranslation(false)
    if (autoplay) speak(sentence.japanese, speed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence.id])

  const revealStage: RevealStage = showTranslation ? 'translation' : showJapanese ? 'jp_text' : 'audio_only'

  const handleAnswer = (comprehension: Comprehension) => {
    onAnswer(comprehension, revealStage, Date.now() - revealedAt)
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Card>
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
            {showJapanese ? (
              <p className="font-medium text-2xl">{sentence.japanese}</p>
            ) : (
              <Button variant="outline" onClick={() => setShowJapanese(true)}>
                Show Japanese text
              </Button>
            )}
          </div>

          <div className="min-h-12 text-center">
            {showJapanese &&
              (showTranslation ? (
                <p className="text-muted-foreground">{sentence.translation}</p>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowTranslation(true)}>
                  Show translation
                </Button>
              ))}
          </div>
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
