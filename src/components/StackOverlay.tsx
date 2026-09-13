import { X } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { PressableButton } from '@/components/PressableButton'
import { playSound } from '@/lib/sounds'

/** The design frame is 402 wide; the column caps there and centres beyond it. */
const FRAME_WIDTH = 402

/** Where a card sits and how far it travels — all of it read off the frames. */
export type StackGeometry = {
  cardW: number
  cardH: number
  /** Vertical distance between consecutive cards; less than cardH, so they overlap. */
  step: number
  /** Top of the first card. */
  stackTop: number
  /** Resting left edge of a stacked card. */
  restLeft: number
  /** Extra left shift applied to the stack while one card is pulled out of it. */
  retreat: number
  selectedLeft: number
  selectedTop: number
  okayLeft: number
  okayTop: number
  /** Width of the title plate; it is always flush to the left edge. */
  titleWidth: number
  titleInset: number
}

type State = { isSelected: boolean; index: number }

type Props<T extends { id: string }> = {
  open: boolean
  onClose: () => void
  title: string
  /** null while loading — the entrance waits for this, see `entered`. */
  items: T[] | null
  geometry: StackGeometry
  /** The card's own visuals: fill, outline, radius, rotation. */
  cardStyle: (state: State) => CSSProperties
  /** What goes inside the card. */
  renderCard: (item: T, state: State) => ReactNode
  emptyMessage: string
  /** Fired when a card is pulled out of the stack — used for audio, where there is any. */
  onSelect?: (item: T) => void
  /** When given, the pulled-out card carries a remove control. */
  onRemove?: (item: T) => Promise<void>
  removeLabel?: (item: T) => string
  /** Rendered under the title plate — a progress line, typically. */
  status?: ReactNode
}

/**
 * The shared shell behind the Saved Words and Saved Sentences overlays.
 *
 * Both are the same interaction — dim and blur the app, slide a deep stack of
 * overlapping cards in from off the left edge, and pull one out to the right
 * when it is picked — differing only in geometry, card styling and what a card
 * says. Everything here is that shared behaviour; the two callers supply the
 * rest.
 */
export function StackOverlay<T extends { id: string }>({
  open,
  onClose,
  title,
  items,
  geometry,
  cardStyle,
  renderCard,
  emptyMessage,
  onSelect,
  onRemove,
  removeLabel,
  status,
}: Props<T>) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Drives the slide-in. See the effect below for why it waits on `items`. */
  const [entered, setEntered] = useState(false)

  /** How far off the left edge the stack starts, clearing the card and its shadow. */
  const entryOffset = geometry.cardW + 40

  // Waits for the items, not just for `open`. The cards don't exist until the
  // IndexedDB read returns, so flipping this on open alone let them mount at
  // their resting position with the transition already finished — no slide at
  // all. Flipping it the frame after the data lands gives them somewhere to
  // travel from.
  useEffect(() => {
    if (!open || !items) {
      setEntered(false)
      return
    }
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [open, items])

  // Closing clears the selection, so reopening always starts at the stack
  // rather than on whatever was last picked.
  useEffect(() => {
    if (!open) setSelectedId(null)
  }, [open])

  /** Esc backs out — the overlay covers the whole app, so it needs a keyboard way out. */
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

  const selected = items?.find((i) => i.id === selectedId) ?? null

  function pick(item: T) {
    playSound('reveal')
    setSelectedId(item.id)
    onSelect?.(item)
  }

  async function remove(item: T) {
    playSound('wordUnsave')
    setSelectedId(null)
    await onRemove?.(item)
  }

  /** Any tap on the darkened area closes outright — "Okay!" is the way back to
   * just the stack. Every layer of the dark region delegates here. */
  const closeIfBackdrop = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-30 flex justify-center"
      style={{
        // The mockup's scrim: a 40% black wash over a light blur, so the screen
        // behind stays legible as context.
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2.5px)',
        WebkitBackdropFilter: 'blur(2.5px)',
      }}
      onPointerDown={closeIfBackdrop}
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ maxWidth: FRAME_WIDTH }}
        onPointerDown={closeIfBackdrop}
      >
        {/* Title plate — flush to the left edge, so it is outlined and rounded on
            three sides only, as though it slid in from off-screen. */}
        <div
          className="absolute flex items-center"
          style={{
            left: 0,
            top: 17,
            width: geometry.titleWidth,
            height: 50,
            paddingLeft: geometry.titleInset,
            background: 'var(--color-surface)',
            borderTop: '2px solid var(--color-ink)',
            borderRight: '2px solid var(--color-ink)',
            borderBottom: '2px solid var(--color-ink)',
            borderRadius: '0 12px 12px 0',
            boxShadow: '0 4px 4px 4px rgba(0, 0, 0, 0.25), 0 4px 0 0 var(--color-ink)',
            transform: entered ? 'translateX(0)' : `translateX(-${geometry.titleWidth + 8}px)`,
            transition: 'transform 420ms var(--ease-damped)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              fontSize: 20,
              color: 'var(--color-on-surface)',
            }}
          >
            {title}
          </span>
        </div>

        {status}

        {items && items.length === 0 && (
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
            {emptyMessage}
          </p>
        )}

        {/* The stack scrolls as one column. Each card is absolutely placed at its
            own step so they overlap; the wrapper's height is the last card's
            bottom, which is what gives the scroller something to scroll. */}
        <div
          className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          onPointerDown={closeIfBackdrop}
        >
          <div
            className="relative"
            style={{ height: geometry.stackTop + (items?.length ?? 0) * geometry.step + geometry.cardH + 80 }}
            onPointerDown={closeIfBackdrop}
          >
            {items?.map((item, index) => {
              const isSelected = item.id === selectedId
              const state: State = { isSelected, index }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (isSelected ? setSelectedId(null) : pick(item))}
                  className="absolute"
                  style={{
                    width: geometry.cardW,
                    height: geometry.cardH,
                    // Selected: floated out to the right. Otherwise: in the
                    // stack, retreating further left while any card is out, and
                    // offset off-screen until the entrance has run.
                    left:
                      (isSelected
                        ? geometry.selectedLeft
                        : geometry.restLeft - (selectedId ? geometry.retreat : 0)) -
                      (entered ? 0 : entryOffset),
                    top: isSelected ? geometry.selectedTop : geometry.stackTop + index * geometry.step,
                    // The chosen card has to clear every card below it in the
                    // stack, not just its immediate neighbour.
                    zIndex: isSelected ? 500 : index,
                    transition:
                      'left 420ms var(--ease-damped), top 420ms var(--ease-damped), transform 420ms var(--ease-damped), background-color 320ms var(--ease-damped)',
                    ...cardStyle(state),
                  }}
                  aria-pressed={isSelected}
                >
                  {isSelected && onRemove && (
                    // Only on the pulled-out card: in the stack the top-right
                    // corner sits under the next card down, so there is nothing
                    // to aim at.
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={removeLabel?.(item) ?? 'Remove'}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        void remove(item)
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        e.stopPropagation()
                        void remove(item)
                      }}
                      className="absolute flex cursor-pointer items-center justify-center rounded-full"
                      style={{ right: 8, top: 8, width: 26, height: 26, zIndex: 2 }}
                    >
                      <X className="size-[18px]" style={{ color: 'var(--color-neutral-700)' }} />
                    </span>
                  )}
                  {renderCard(item, state)}
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
              left: geometry.okayLeft,
              top: geometry.okayTop,
              width: 116,
              height: 48,
              zIndex: 600,
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-shadow)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 18,
              color: 'var(--color-on-surface)',
            }}
          >
            Okay!
          </PressableButton>
        )}
      </div>
    </div>
  )
}
