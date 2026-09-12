import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ArchiveAdd, VolumeHigh } from '@/components/icons'
import { PressableButton } from '@/components/PressableButton'
import { SegmentedTranslation } from '@/components/SegmentedTranslation'
import { isSentenceSaved, saveSentence, unsaveSentence } from '@/lib/savedSentences'
import { speechTextFor } from '@/lib/tts'
import { playSound } from '@/lib/sounds'
import type { Comprehension, RevealStage, Sentence } from '@/lib/types'
import { useAudioPlayer } from '@/lib/useAudioPlayer'

type Props = {
  sentence: Sentence
  /** True for a card already rated this session, revisited via swipe-back —
   * shown revealed, no rating buttons, doesn't touch its existing data. */
  viewOnly: boolean
  onAnswer: (comprehension: Comprehension, revealStage: RevealStage, responseLatencyMs: number) => void
  onSwipe: (direction: 'next' | 'previous') => void
}

/** Every 2px outline and the slab under the card (DESIGN.md → Tokens). */
const INK = 'var(--color-ink)'
/**
 * The saved state isn't drawn in the mockup, so it takes the palette's salmon
 * — a colour the design already owns — rather than inventing one.
 */
const SAVED_COLOR = '#F69687'
const SWIPE_THRESHOLD_PX = 50

/** Card width and the two heights it moves between, straight from the frames:
 * 321 wide, 176 closed (`StudyTab - No Translation`) → 235 revealed. */
const CARD_WIDTH = 321
const CARD_HEIGHT_CLOSED = 176
const CARD_HEIGHT_REVEALED = 235

/** §1's three comprehension responses. Laid out as an upside-down triangle —
 * the third button sits centered beneath the first two, same width as each. */
const RATINGS: { comprehension: Comprehension; label: string }[] = [
  { comprehension: 1, label: 'Easy' },
  { comprehension: 2, label: 'Needed Text' },
  { comprehension: 3, label: "Don't know" },
]

export function SentenceCard({ sentence, viewOnly, onAnswer, onSwipe }: Props) {
  const [revealed, setRevealed] = useState(viewOnly)
  const [revealedAt] = useState(() => Date.now())
  const { play, isLoading, isPlaying } = useAudioPlayer()
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const [starred, setStarred] = useState(false)

  // A live card starts closed; a revisited (viewOnly) card opens already
  // revealed — matching how it was left. Audio never autoplays here (cost
  // control): the replay button below is the only way it ever plays.
  useEffect(() => {
    setRevealed(viewOnly)
    void isSentenceSaved(sentence.id).then(setStarred)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence.id])

  async function handleToggleStar() {
    if (starred) {
      playSound('sentenceUnsave')
      await unsaveSentence(sentence.id)
      setStarred(false)
    } else {
      playSound('sentenceSave')
      await saveSentence(sentence)
      setStarred(true)
    }
  }

  const handleAnswer = (comprehension: Comprehension) => {
    onAnswer(comprehension, revealed ? 'translation' : 'audio_only', Date.now() - revealedAt)
  }

  async function handlePlay() {
    try {
      // Speaks the deck's kana reading when it supplies one (§8) — the card
      // still shows the kanji.
      await play(speechTextFor(sentence))
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
      // Plain tap toggles — tapping the open card again closes it. The sound is
      // played out here, not inside the updater: StrictMode double-invokes state
      // updaters to surface impurity, which fired the blip twice in dev.
      const next = !revealed
      if (next) playSound('reveal')
      setRevealed(next)
      return
    }
    onSwipe(dx < 0 ? 'next' : 'previous') // swipe left/right navigates between cards, not reveal
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
        className="relative w-full touch-pan-y select-none"
        style={{
          maxWidth: CARD_WIDTH,
          // The card grows as the glosses appear rather than jumping — the two
          // heights are what the mockup draws for closed and revealed.
          minHeight: revealed ? CARD_HEIGHT_REVEALED : CARD_HEIGHT_CLOSED,
          transition: 'min-height 320ms var(--ease-damped)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'var(--color-surface)',
          border: `2px solid ${INK}`,
          borderRadius: 'var(--radius-card)',
          // Paint-only slab, never a border-bottom-width — see lib/press.ts for
          // why that distinction matters here.
          boxShadow: `0 var(--depth-card) 0 0 ${INK}`,
          // Clears the two corner controls (24px glyphs inset 11-14px).
          padding: '46px 18px 30px',
          textAlign: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => void handleToggleStar()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          aria-label={starred ? 'Remove from saved sentences' : 'Save this sentence'}
          aria-pressed={starred}
          className="absolute flex items-center justify-center"
          style={{ left: 12, top: 9, width: 24, height: 24 }}
        >
          <ArchiveAdd
            size={24}
            style={{
              color: starred ? SAVED_COLOR : 'var(--color-icon)',
              transition: 'color 200ms var(--ease-damped)',
            }}
          />
        </button>

        <button
          type="button"
          onClick={() => void handlePlay()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          disabled={isLoading}
          aria-label="Replay audio"
          className="absolute flex items-center justify-center disabled:opacity-60"
          style={{ right: 11, top: 9, width: 24, height: 24 }}
        >
          {isLoading ? (
            <Loader2 className="size-[22px] animate-spin" style={{ color: 'var(--color-icon)' }} />
          ) : isPlaying ? (
            <span className="flex h-[14px] items-center gap-[2.5px]">
              {[0, 0.15, 0.3, 0.45].map((delay) => (
                <span
                  key={delay}
                  className="w-[2.5px] rounded-sm"
                  style={{
                    height: '100%',
                    background: 'var(--color-icon)',
                    animation: `eqbar 0.55s ease-in-out infinite ${delay}s`,
                  }}
                />
              ))}
            </span>
          ) : (
            <VolumeHigh size={24} style={{ color: 'var(--color-icon)' }} />
          )}
        </button>

        <SegmentedTranslation
          japanese={sentence.japanese}
          naturalKorean={sentence.translation}
          revealed={revealed}
        />
      </div>

      {revealed && !viewOnly && (
        // Pinned to the bottom of the viewport, not the card — thumb-reachable
        // one-handed regardless of where the card itself sits on the page.
        // 128px clears the screen toggle (56px tall, sitting 60px up in the
        // mockup) with the ~12px breathing room the frames show.
        <div
          className="fixed inset-x-0 bottom-0 z-10 flex justify-center px-4"
          style={{ paddingBottom: 'calc(128px + env(safe-area-inset-bottom))' }}
        >
          {/* 4 columns so the bottom button can span the middle 2 — exactly the
              width of either top button — and land centered beneath them. At the
              design's 352px content width each span-2 measures 171px, which is
              the mockup's 170. */}
          <div
            className="grid w-full grid-cols-4"
            style={{ maxWidth: 352, columnGap: 10, rowGap: 23 }}
          >
            {RATINGS.map((r, i) => (
              <PressableButton
                key={r.comprehension}
                type="button"
                onClick={() => handleAnswer(r.comprehension)}
                className={`col-span-2 flex items-center justify-center ${i === 2 ? 'col-start-2' : ''}`}
                restDepthPx={4}
                shadowColor="var(--color-shadow)"
                style={{
                  height: 48,
                  background: 'var(--color-surface)',
                  border: `1.5px solid ${INK}`,
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 18,
                  color: 'var(--color-text)',
                }}
              >
                {r.label}
              </PressableButton>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
