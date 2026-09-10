import { Loader2, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ApiKeyCard } from '@/components/ApiKeyCard'
import { SegmentedTranslation } from '@/components/SegmentedTranslation'
import { setOpenAiApiKey } from '@/lib/apiKey'
import type { Comprehension, RevealStage, Sentence } from '@/lib/types'
import { useAudioPlayer } from '@/lib/useAudioPlayer'

type Props = {
  sentence: Sentence
  onAnswer: (comprehension: Comprehension, revealStage: RevealStage, responseLatencyMs: number) => void
}

const STROKE = '#312F2A'
const REVEAL_STAGES: RevealStage[] = ['audio_only', 'jp_text', 'translation']
const SWIPE_THRESHOLD_PX = 50

/** §1's three comprehension responses (revised from a 4-way scale — see SPEC.md). */
const RATINGS: { comprehension: Comprehension; label: string; fullWidth?: boolean }[] = [
  { comprehension: 1, label: 'Easy' },
  { comprehension: 2, label: 'Needed text' },
  { comprehension: 3, label: "Don't know", fullWidth: true },
]

export function SentenceCard({ sentence, onAnswer }: Props) {
  const [stageIndex, setStageIndex] = useState(0)
  const [revealedAt] = useState(() => Date.now())
  const [showKeyCard, setShowKeyCard] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const { play, autoplay: autoplayAudio, isLoading, isPlaying, lastEngine, fallbackReason } = useAudioPlayer()
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const revealStage = REVEAL_STAGES[stageIndex]

  useEffect(() => {
    setStageIndex(0)
    setAudioError(null)
    autoplayAudio(sentence.japanese)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence.id])

  const handleAnswer = (comprehension: Comprehension) => {
    onAnswer(comprehension, revealStage, Date.now() - revealedAt)
  }

  const advanceStage = () => setStageIndex((i) => Math.min(i + 1, REVEAL_STAGES.length - 1))
  const retreatStage = () => setStageIndex((i) => Math.max(i - 1, 0))

  async function handlePlay() {
    setAudioError(null)
    try {
      await play(sentence.japanese)
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : String(e))
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!swipeStart.current) return
    const dx = e.clientX - swipeStart.current.x
    const dy = e.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) {
      // Not a swipe — treat as a plain tap-to-advance, same as tapping the reveal area.
      if (stageIndex < REVEAL_STAGES.length - 1) advanceStage()
      return
    }
    if (dx < 0) advanceStage()
    else retreatStage()
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
        className="card relative touch-pan-y select-none"
        style={{ padding: '20px 20px 22px', textAlign: 'center', borderColor: STROKE, borderBottomWidth: 6 }}
      >
        <button
          type="button"
          onClick={() => void handlePlay()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          disabled={isLoading}
          aria-label="Replay audio"
          className="absolute top-3.5 right-3.5 flex size-7 items-center justify-center rounded-full disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="size-[18px] animate-spin" style={{ color: 'var(--color-accent-500)' }} />
          ) : isPlaying ? (
            <span className="flex h-[13px] items-center gap-[2px]">
              {[0, 0.15, 0.3, 0.45].map((delay) => (
                <span
                  key={delay}
                  className="h-full w-[2.5px] rounded-sm"
                  style={{ background: 'var(--color-accent-500)', animation: `eqbar 0.55s ease-in-out infinite ${delay}s` }}
                />
              ))}
            </span>
          ) : (
            <Volume2 className="size-[18px]" style={{ color: 'var(--color-accent-500)' }} />
          )}
        </button>

        {!showKeyCard && lastEngine === 'webspeech' && (
          <button
            type="button"
            className="mt-1 text-[11px] underline-offset-2 hover:underline"
            style={{ color: 'var(--color-neutral-500)' }}
            onClick={() => setShowKeyCard(true)}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {fallbackReason === 'openai-failed'
              ? 'Using free browser voice — OpenAI TTS failed (check your key/billing)'
              : 'Using free browser voice — add an OpenAI key for higher quality'}
          </button>
        )}

        {showKeyCard && (
          <div
            className="mt-3"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <ApiKeyCard
              providerLabel="OpenAI"
              envVarName="VITE_OPENAI_API_KEY"
              placeholder="sk-..."
              onSave={setOpenAiApiKey}
              onSaved={() => {
                setShowKeyCard(false)
                void handlePlay()
              }}
              onCancel={() => setShowKeyCard(false)}
            />
          </div>
        )}

        {audioError && <p className="mt-2 text-destructive text-xs">{audioError}</p>}

        <div className="mt-9 min-h-16">
          {stageIndex >= 1 ? (
            <p
              style={{
                fontFamily: '"Noto Sans JP", var(--font-body), sans-serif',
                fontSize: 24,
                lineHeight: 1.5,
                color: 'var(--color-text)',
              }}
            >
              {sentence.japanese}
            </p>
          ) : (
            <p className="text-[13px]" style={{ color: 'var(--color-neutral-400)' }}>
              Tap to reveal
            </p>
          )}
        </div>

        <div className="mt-2 min-h-12">
          {stageIndex >= 2 && <SegmentedTranslation japanese={sentence.japanese} naturalKorean={sentence.translation} />}
        </div>

        <p className="mt-3 text-[11px]" style={{ color: 'var(--color-neutral-400)' }}>
          Tap or swipe to reveal
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {RATINGS.map((r) => (
          <button
            key={r.comprehension}
            type="button"
            onClick={() => handleAnswer(r.comprehension)}
            className={`btn btn-secondary ${r.fullWidth ? 'col-span-2' : ''}`}
            style={{ borderColor: STROKE, borderBottomWidth: 3 }}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}
