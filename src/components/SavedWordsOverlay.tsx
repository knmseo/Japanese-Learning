import { useEffect, useRef, useState } from 'react'
import { StackOverlay, type StackGeometry } from '@/components/StackOverlay'
import { prepareSpeech } from '@/lib/commuteBundle'
import { deleteSavedSegmentById, listSavedWords, type SavedWord } from '@/lib/savedSegments'
import { useAudioPlayer } from '@/lib/useAudioPlayer'

type Props = {
  open: boolean
  onClose: () => void
}

/** Geometry from the two `SavedWords Tab` frames (DESIGN.md → Saved Words). */
const GEOMETRY: StackGeometry = {
  cardW: 287,
  cardH: 129,
  /** Cards overlap — only 51px of each is exposed before the next covers it. */
  step: 51,
  stackTop: 119,
  /** Most of a stacked card hangs off the left edge. */
  restLeft: -90,
  retreat: 140,
  selectedLeft: 96,
  selectedTop: 395,
  okayLeft: 181,
  okayTop: 546,
  titleWidth: 177,
  titleInset: 24,
}

const CARD_TILT_DEG = 5
/** These cards carry an ambient drop shadow *and* the usual hard slab. */
const CARD_SHADOW = '0 4px 4px 4px rgba(0, 0, 0, 0.25), 0 4px 0 0 var(--color-stat-edge)'

/**
 * Where the two lines sit inside a card, measured from its top edge.
 *
 * In the stack the word has to live inside the 51px strip the next card leaves
 * exposed, so it rides high — centring it would bury every word but the last
 * under the card above. The meaning sits below the fold and is only visible on
 * the bottom card, which is what the frame draws. A card pulled out of the
 * stack has room for both, so its text moves down towards the middle.
 */
const TEXT_STACKED = { word: 28, meaning: 81 }
const TEXT_SELECTED = { word: 44, meaning: 79 }

/**
 * Saved words, as a stack of tilted cards over a dimmed Browse screen. Picking
 * one straightens it, tints it, floats it out and speaks it.
 */
export function SavedWordsOverlay({ open, onClose }: Props) {
  const [words, setWords] = useState<SavedWord[] | null>(null)
  /** Non-null only while the pre-fetch is actually fetching something. */
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null)
  const { play } = useAudioPlayer()
  /** Guards the pre-fetch so reopening the overlay doesn't restart it. */
  const prefetched = useRef(false)

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

  /**
   * Download every saved word's audio up front, so tapping one plays instantly
   * and keeps working offline.
   *
   * Only ever fetches what isn't already cached — prepareSpeech checks first —
   * so this costs nothing on a second open, and because the cache is keyed on
   * the spoken text a word already fetched by a tap is not fetched again. It
   * runs once per mount: reopening does not restart it.
   *
   * Failures are silent. With no key and no invite token this does nothing at
   * all and taps fall back to the browser voice, exactly as before.
   */
  useEffect(() => {
    if (!open || !words || words.length === 0 || prefetched.current) return
    prefetched.current = true

    let cancelled = false
    void (async () => {
      await prepareSpeech(
        words.map((w) => w.japanese),
        (done, total) => {
          if (!cancelled && done < total) setDownloading({ done, total })
        },
      ).catch(() => null)
      if (!cancelled) setDownloading(null)
    })()

    return () => {
      cancelled = true
    }
  }, [open, words])

  return (
    <StackOverlay
      open={open}
      onClose={onClose}
      title="Saved Words"
      items={words}
      geometry={GEOMETRY}
      emptyMessage="No saved words yet — tap a word after revealing a translation to collect it here."
      // Speaking the word is the point of picking it, so this fires on
      // selection rather than behind a second tap. Failures degrade to the
      // browser voice inside the player and are swallowed here.
      onSelect={(word) => void play(word.japanese).catch(() => {})}
      onRemove={async (word) => {
        await deleteSavedSegmentById(word.id)
        setWords(await listSavedWords())
      }}
      removeLabel={(word) => `Remove ${word.japanese} from saved words`}
      cardStyle={({ isSelected }) => ({
        transform: `rotate(${isSelected ? 0 : CARD_TILT_DEG}deg)`,
        background: isSelected ? 'var(--color-accent-500)' : 'var(--color-surface)',
        border: '2px solid var(--color-stat-edge)',
        borderRadius: 'var(--radius-tile)',
        boxShadow: CARD_SHADOW,
      })}
      status={
        downloading ? (
          <p
            className="absolute tabular-nums"
            style={{
              left: 24,
              top: 74,
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--color-surface)',
              opacity: 0.75,
            }}
          >
            Downloading audio {downloading.done} / {downloading.total}
          </p>
        ) : null
      }
      renderCard={(word, { isSelected }) => {
        const text = isSelected ? TEXT_SELECTED : TEXT_STACKED
        return (
          <>
            <span
              className="absolute inset-x-0 text-center"
              style={{
                top: text.word,
                transform: 'translateY(-50%)',
                // Same faces the study card uses, so a word reads identically
                // wherever it appears (the frames set both in Kaisei Tokumin,
                // which is the app's heading face, not its Japanese one).
                fontFamily: 'var(--font-jp)',
                fontWeight: 500,
                fontSize: 20,
                color: 'var(--color-on-surface)',
                transition: 'top 420ms var(--ease-damped)',
              }}
            >
              {word.japanese}
            </span>
            <span
              className="absolute inset-x-0 text-center"
              style={{
                top: text.meaning,
                transform: 'translateY(-50%)',
                fontFamily: 'var(--font-kr)',
                fontWeight: 500,
                fontSize: 15,
                color: 'var(--color-neutral-600)',
                transition: 'top 420ms var(--ease-damped)',
              }}
            >
              {word.korean}
            </span>
          </>
        )
      }}
    />
  )
}
