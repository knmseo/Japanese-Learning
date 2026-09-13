import { useEffect, useRef, useState } from 'react'
import { PressableButton } from '@/components/PressableButton'
import { listSavedWords, type SavedWord } from '@/lib/savedSegments'
import { playSound } from '@/lib/sounds'
import { useAudioPlayer } from '@/lib/useAudioPlayer'

type Props = {
  open: boolean
  onClose: () => void
}

/* Geometry from the two `SavedWords Tab` frames (DESIGN.md → Saved Words). */
const FRAME_WIDTH = 402
/** Card box. The stack draws it rotated; the selected card straightens. */
const CARD_W = 287
const CARD_H = 129
/** Cards overlap — only 51px of each is exposed before the next one covers it. */
const CARD_STEP = 51
const CARD_TILT_DEG = 5
/** Resting left edge of a stacked card: most of it hangs off the left edge. */
const STACK_LEFT = -90
/** How much further left the stack slides when a card is picked out of it. */
const STACK_RETREAT = 140
/** Where the chosen card lands, straightened. */
const SELECTED_LEFT = 96
const SELECTED_TOP = 395
const STACK_TOP = 119

/** Both card states carry an ambient drop shadow *and* the usual hard slab. */
const CARD_SHADOW = '0 4px 4px 4px rgba(0, 0, 0, 0.25), 0 4px 0 0 var(--color-stat-edge)'

/**
 * Where the two lines sit inside a card, measured from its top edge.
 *
 * In the stack the word has to live inside the 51px strip the next card leaves
 * exposed, so it rides high — centring it would bury every word but the last
 * under the card above. The meaning sits below the fold and is only visible on
 * the bottom card, which is what the frame draws. A card picked out of the
 * stack has room for both, so its text moves down towards the middle.
 */
const TEXT_STACKED = { word: 28, meaning: 81 }
const TEXT_SELECTED = { word: 44, meaning: 79 }

/**
 * The Saved Words review overlay.
 *
 * Opening it dims and blurs whatever is behind (the Browse screen) rather than
 * navigating away, so the list reads as something laid over the app. The words
 * arrive as a deep stack of tilted cards anchored off the left edge; picking one
 * straightens it, floats it out to the right, tints it, and pushes the rest of
 * the stack further into the side.
 *
 * Choosing a word also speaks it — see `select()`.
 */
export function SavedWordsOverlay({ open, onClose }: Props) {
  const [words, setWords] = useState<SavedWord[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { play } = useAudioPlayer()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listSavedWords().then((w) => {
      if (!cancelled) setWords(w)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Closing clears the selection, so reopening always starts at the stack
  // rather than on whatever was last picked.
  useEffect(() => {
    if (!open) setSelectedId(null)
  }, [open])

  /** Esc closes — the overlay covers the whole app, so it needs a keyboard way out. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selectedId) setSelectedId(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selectedId, onClose])

  if (!open) return null

  const selected = words?.find((w) => w.id === selectedId) ?? null

  function select(word: SavedWord) {
    playSound('reveal')
    setSelectedId(word.id)
    // Speaking the word is the point of picking it, so this fires on selection
    // rather than behind a second tap. Failures degrade to the browser voice
    // inside the player and are swallowed here — audio never blocks the UI.
    void play(word.japanese).catch(() => {})
  }

  return (
    <div
      className="fixed inset-0 z-30 flex justify-center"
      style={{
        // The mockup's scrim, exactly: a 40% black wash over a light blur, so
        // the Browse screen stays legible underneath as context.
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2.5px)',
        WebkitBackdropFilter: 'blur(2.5px)',
      }}
      // A tap on the scrim backs out one level: first the selection, then the
      // whole overlay.
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (selectedId) setSelectedId(null)
        else onClose()
      }}
      role="dialog"
      aria-modal
      aria-label="Saved words"
    >
      <div className="relative h-full w-full overflow-hidden" style={{ maxWidth: FRAME_WIDTH }}>
        {/* Title plate — flush to the left edge, so it is outlined and rounded
            on three sides only, as though it slid in from off-screen. */}
        <div
          className="absolute flex items-center"
          style={{
            left: 0,
            top: 17,
            width: 177,
            height: 50,
            paddingLeft: 24,
            background: 'var(--color-surface)',
            borderTop: '2px solid var(--color-ink)',
            borderRight: '2px solid var(--color-ink)',
            borderBottom: '2px solid var(--color-ink)',
            borderRadius: '0 12px 12px 0',
            boxShadow: '0 4px 4px 4px rgba(0, 0, 0, 0.25), 0 4px 0 0 var(--color-ink)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              fontSize: 20,
              color: 'var(--color-text)',
            }}
          >
            Saved Words
          </span>
        </div>

        {words && words.length === 0 && (
          <p
            className="absolute text-center"
            style={{
              left: 0,
              right: 0,
              top: 300,
              paddingInline: 40,
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-surface)',
            }}
          >
            No saved words yet — tap a word after revealing a translation to collect it here.
          </p>
        )}

        {/* The stack scrolls as one column. Each card is absolutely placed at its
            own step so they overlap; the container's height is the last card's
            bottom, which is what gives the scroller something to scroll. */}
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          <div
            className="relative"
            style={{ height: STACK_TOP + (words?.length ?? 0) * CARD_STEP + CARD_H + 80 }}
          >
            {words?.map((word, i) => {
              const isSelected = word.id === selectedId
              return (
                <button
                  key={word.id}
                  type="button"
                  onClick={() => (isSelected ? setSelectedId(null) : select(word))}
                  className="absolute"
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    // Selected: straightened, tinted, floated out to the right.
                    // Otherwise: tilted in the stack, retreating further left
                    // while any card is out.
                    left: isSelected ? SELECTED_LEFT : STACK_LEFT - (selectedId ? STACK_RETREAT : 0),
                    top: isSelected ? SELECTED_TOP : STACK_TOP + i * CARD_STEP,
                    transform: `rotate(${isSelected ? 0 : CARD_TILT_DEG}deg)`,
                    background: isSelected ? 'var(--color-accent-500)' : 'var(--color-surface)',
                    border: '2px solid var(--color-stat-edge)',
                    borderRadius: 'var(--radius-tile)',
                    boxShadow: CARD_SHADOW,
                    // The chosen card has to clear every card below it in the
                    // stack, not just its immediate neighbour.
                    zIndex: isSelected ? 500 : i,
                    transition:
                      'left 420ms var(--ease-damped), top 420ms var(--ease-damped), transform 420ms var(--ease-damped), background-color 320ms var(--ease-damped)',
                  }}
                  aria-pressed={isSelected}
                >
                  <span
                    className="absolute inset-x-0 text-center"
                    style={{
                      top: (isSelected ? TEXT_SELECTED : TEXT_STACKED).word,
                      transform: 'translateY(-50%)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 500,
                      fontSize: 20,
                      color: 'var(--color-text)',
                      transition: 'top 420ms var(--ease-damped)',
                    }}
                  >
                    {word.japanese}
                  </span>
                  <span
                    className="absolute inset-x-0 text-center"
                    style={{
                      top: (isSelected ? TEXT_SELECTED : TEXT_STACKED).meaning,
                      transform: 'translateY(-50%)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 500,
                      fontSize: 15,
                      color: 'var(--color-neutral-600)',
                      transition: 'top 420ms var(--ease-damped)',
                    }}
                  >
                    {word.korean}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Dismisses the selection back into the stack, not the whole overlay. */}
        {selected && (
          <PressableButton
            type="button"
            onClick={() => setSelectedId(null)}
            className="absolute flex items-center justify-center"
            restDepthPx={4}
            shadowColor="var(--color-shadow)"
            style={{
              left: SELECTED_LEFT + 85,
              top: 546,
              width: 116,
              height: 48,
              zIndex: 600,
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-shadow)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 18,
              color: 'var(--color-text)',
            }}
          >
            Okay!
          </PressableButton>
        )}
      </div>
    </div>
  )
}
