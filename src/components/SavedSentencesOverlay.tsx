import { useEffect, useState } from 'react'
import { StackOverlay, type StackGeometry } from '@/components/StackOverlay'
import { deleteSavedSentenceById, listSavedSentences } from '@/lib/savedSentences'
import type { SavedSentence } from '@/lib/types'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Geometry from the two `SavedSenetences` frames (DESIGN.md → Saved Sentences).
 *
 * Wider and less overlapped than the word stack, because a card has to hold a
 * whole sentence rather than one word, and sitting flush to the left edge
 * rather than hanging off it.
 */
const GEOMETRY: StackGeometry = {
  cardW: 335,
  cardH: 129,
  /** 100 of each card's 129 stays exposed — much more than the word stack's 51. */
  step: 100,
  stackTop: 130,
  /** Flush to the left edge rather than hanging off it. */
  restLeft: 0,
  /** …which means the card needs to bleed past that edge, or the entrance's
   * overshoot (~42px here) would expose its flat left side mid-screen. */
  bleedLeft: 60,
  retreat: 190,
  selectedLeft: 50,
  selectedTop: 329,
  okayLeft: 181,
  okayTop: 478,
  titleWidth: 217,
  titleInset: 31,
}

/** These cards drop only the hard slab — no ambient shadow, unlike the words'. */
const CARD_SHADOW = '0 4px 0 0 var(--color-ink)'

/**
 * Saved sentences, as a stack of cards over a dimmed Browse screen. The stack
 * shows each sentence in Japanese; picking one rounds it off, tints it, floats
 * it out and shows the translation in its place.
 *
 * No audio here, unlike Saved Words — these are for reading.
 */
export function SavedSentencesOverlay({ open, onClose }: Props) {
  const [sentences, setSentences] = useState<SavedSentence[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listSavedSentences().then((s) => {
      if (!cancelled) setSentences(s)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <StackOverlay
      open={open}
      onClose={onClose}
      title="Saved Sentences"
      items={sentences}
      geometry={GEOMETRY}
      emptyMessage="No saved sentences yet — tap the bookmark on a card while studying to collect it here."
      onRemove={async (sentence) => {
        await deleteSavedSentenceById(sentence.id)
        setSentences(await listSavedSentences())
      }}
      removeLabel={(sentence) => `Remove ${sentence.japanese} from saved sentences`}
      cardStyle={({ isSelected }) => ({
        background: isSelected ? 'var(--color-accent-500)' : 'var(--color-surface)',
        // A stacked card is flush to the left edge, so it is outlined and
        // rounded on three sides only; pulled out, it closes up on all four.
        border: '2px solid var(--color-ink)',
        borderLeftWidth: isSelected ? 2 : 0,
        borderRadius: isSelected ? 'var(--radius-tile)' : '0 12px 12px 0',
        boxShadow: CARD_SHADOW,
      })}
      renderCard={(sentence, { isSelected, bleed }) =>
        isSelected ? (
          // Pulled out, the card turns over: the translation replaces the
          // Japanese rather than sitting under it.
          <span
            className="absolute text-center"
            style={{
              left: 25,
              right: 25,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-kr)',
              fontWeight: 500,
              fontSize: 18,
              lineHeight: 1.5,
              color: 'var(--color-neutral-600)',
            }}
          >
            {sentence.translation}
          </span>
        ) : (
          <span
            className="absolute text-center"
            style={{
              // Inset past the off-screen bleed, so the text stays centred in
              // the part of the card you can actually see.
              left: 25 + bleed,
              right: 25,
              // Sits where the frame puts it — inside the 100px strip the next
              // card leaves exposed, not centred in the full card.
              top: 63,
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-jp)',
              fontWeight: 500,
              fontSize: 22,
              lineHeight: 1.35,
              color: 'var(--color-on-surface)',
            }}
          >
            {sentence.japanese}
          </span>
        )
      }
    />
  )
}
