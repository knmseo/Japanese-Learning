import { Loader2, Star, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SegmentedTranslation } from '@/components/SegmentedTranslation'
import { isSentenceSaved, saveSentence, unsaveSentence } from '@/lib/savedSentences'
import type { Comprehension, RevealStage, Sentence } from '@/lib/types'
import { useAudioPlayer } from '@/lib/useAudioPlayer'

type Props = {
  sentence: Sentence
  onAnswer: (comprehension: Comprehension, revealStage: RevealStage, responseLatencyMs: number) => void
}

const STROKE = '#312F2A'
const SAVED_COLOR = '#E4572E'
const SWIPE_THRESHOLD_PX = 50

/** §1's three comprehension responses. */
const RATINGS: { comprehension: Comprehension; label: string; fullWidth?: boolean }[] = [
  { comprehension: 1, label: 'Easy' },
  { comprehension: 2, label: 'Needed text' },
  { comprehension: 3, label: "Don't know", fullWidth: true },
]

export function SentenceCard({ sentence, onAnswer }: Props) {
  const [revealed, setRevealed] = useState(false)
  const [revealedAt] = useState(() => Date.now())
  const { play, autoplay: autoplayAudio, isLoading, isPlaying } = useAudioPlayer()
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const autoplayedFor = useRef<string | null>(null)
  const [starred, setStarred] = useState(false)

  // Autoplay on first look only; the icon is the manual replay. Guarded by a ref because
  // StrictMode double-invokes effects in dev — without it the sentence fires twice, which
  // is audibly masked by cancel() but really does spend two TTS requests.
  useEffect(() => {
    setRevealed(false)
    void isSentenceSaved(sentence.id).then(setStarred)
    if (autoplayedFor.current === sentence.id) return
    autoplayedFor.current = sentence.id
    autoplayAudio(sentence.japanese)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence.id])

  async function handleToggleStar() {
    if (starred) {
      await unsaveSentence(sentence.id)
      setStarred(false)
    } else {
      await saveSentence(sentence)
      setStarred(true)
    }
  }

  const handleAnswer = (comprehension: Comprehension) => {
    onAnswer(comprehension, revealed ? 'translation' : 'audio_only', Date.now() - revealedAt)
  }

  async function handlePlay() {
    try {
      await play(sentence.japanese)
    } catch {
      // Audio failures degrade silently to the browser voice — no error text on the card.
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
      setRevealed(true) // plain tap reveals
      return
    }
    setRevealed(dx < 0) // swipe left reveals, right hides
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
        className="card relative touch-pan-y select-none"
        style={{
          padding: '28px 20px 30px',
          textAlign: 'center',
          borderColor: STROKE,
          borderBottomWidth: 6,
          minHeight: 190,
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => void handleToggleStar()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          aria-label={starred ? 'Remove from saved sentences' : 'Save this sentence'}
          aria-pressed={starred}
          className="absolute top-3.5 left-3.5 flex size-7 items-center justify-center rounded-full"
        >
          <Star
            className="size-[18px]"
            style={{ color: starred ? SAVED_COLOR : 'var(--color-neutral-400)' }}
            fill={starred ? SAVED_COLOR : 'none'}
          />
        </button>

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
                  style={{
                    background: 'var(--color-accent-500)',
                    animation: `eqbar 0.55s ease-in-out infinite ${delay}s`,
                  }}
                />
              ))}
            </span>
          ) : (
            <Volume2 className="size-[18px]" style={{ color: 'var(--color-accent-500)' }} />
          )}
        </button>

        <SegmentedTranslation
          japanese={sentence.japanese}
          naturalKorean={sentence.translation}
          revealed={revealed}
        />
      </div>

      {revealed && (
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
      )}
    </div>
  )
}
