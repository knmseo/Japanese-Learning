import { useEffect, useState } from 'react'
import { hashText } from '@/lib/hash'
import { isSegmentSaved, saveSegment, unsaveSegment } from '@/lib/savedSegments'
import { getSegmentationForDisplay } from '@/lib/segmentationGenerator'
import { playSound } from '@/lib/sounds'
import type { SentenceSegment } from '@/lib/types'

type Props = {
  japanese: string
  naturalKorean: string
  revealed: boolean
}

const SAVED_COLOR = '#E4572E'

/**
 * §15/§16: the single Japanese renderer for the card. Segments are rendered
 * from first paint with zero gap — Japanese has no spaces, so that reads as
 * one plain sentence. Revealing transitions the gap and per-segment padding
 * so the sentence visibly spreads into learning chunks, while the Korean
 * glosses (whose height is always reserved, so nothing reflows) fade in
 * beneath each chunk.
 *
 * Study-time only ever reads cached segmentation — decks ship pre-segmented,
 * so this never calls an LLM.
 */
export function SegmentedTranslation({ japanese, naturalKorean, revealed }: Props) {
  const [segments, setSegments] = useState<SentenceSegment[] | null>(null)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [sourceHash, setSourceHash] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSegments(null)
    setSavedKeys(new Set())

    void (async () => {
      const hash = await hashText(japanese)
      if (cancelled) return
      setSourceHash(hash)

      const segmentation = await getSegmentationForDisplay(japanese, naturalKorean)
      if (cancelled) return
      setSegments(segmentation.segments)

      const savedFlags = await Promise.all(
        segmentation.segments.map(async (s) => ((await isSegmentSaved(s.japanese, hash)) ? s.japanese : null)),
      )
      if (cancelled) return
      setSavedKeys(new Set(savedFlags.filter((v): v is string => v !== null)))
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [japanese])

  /** Toggle — tapping a saved segment again deselects it. Only active once revealed. */
  async function handleTapSegment(segment: SentenceSegment) {
    if (!sourceHash || !revealed) return
    const alreadySaved = savedKeys.has(segment.japanese)

    if (alreadySaved) {
      playSound('wordUnsave')
      await unsaveSegment(segment.japanese, sourceHash)
      setSavedKeys((prev) => {
        const next = new Set(prev)
        next.delete(segment.japanese)
        return next
      })
    } else {
      playSound('wordSave')
      await saveSegment(segment, sourceHash)
      setSavedKeys((prev) => new Set(prev).add(segment.japanese))
    }
  }

  // Until segmentation resolves, render the plain sentence so the card never flashes empty.
  if (!segments) {
    return (
      <p
        style={{
          fontFamily: '"Noto Sans JP", var(--font-body), sans-serif',
          fontSize: 26,
          lineHeight: 1.45,
          color: 'var(--color-text)',
        }}
      >
        {japanese}
      </p>
    )
  }

  return (
    <div
      className="flex flex-wrap items-start justify-center"
      style={{ gap: revealed ? '10px' : '0px', transition: 'gap 320ms var(--ease-damped)' }}
    >
      {segments.map((segment, i) => {
        const saved = savedKeys.has(segment.japanese)
        return (
          <button
            key={`${segment.japanese}-${i}`}
            type="button"
            onClick={() => void handleTapSegment(segment)}
            // Only swallow the tap once revealed — a saved-word tap shouldn't also
            // toggle the card. Before reveal it must bubble up to the card's own
            // handler, which is what turns a tap anywhere on the box into a reveal.
            // (A plain `disabled` button here used to eat the tap outright: disabled
            // elements don't dispatch pointer events at all in most browsers, so a
            // touch landing on the Japanese text itself — most of the box — never
            // reached the card. Only the padding around it worked.)
            onPointerDown={(e) => revealed && e.stopPropagation()}
            onPointerUp={(e) => revealed && e.stopPropagation()}
            className="flex select-none flex-col items-center rounded-sm"
            style={{
              paddingInline: revealed ? '5px' : '0px',
              paddingBlock: revealed ? '2px' : '0px',
              background: saved && revealed ? `color-mix(in srgb, ${SAVED_COLOR} 10%, transparent)` : 'transparent',
              transition: 'padding 320ms var(--ease-damped), background-color 200ms var(--ease-damped)',
              cursor: revealed ? 'pointer' : 'default',
              WebkitUserSelect: 'none',
            }}
            aria-label={saved ? `Deselect ${segment.japanese}` : `Save ${segment.japanese}`}
            aria-pressed={saved}
          >
            <span
              style={{
                fontFamily: '"Noto Sans JP", var(--font-body), sans-serif',
                fontSize: 26,
                lineHeight: 1.45,
                color: saved && revealed ? SAVED_COLOR : 'var(--color-text)',
                transition: 'color 200ms var(--ease-damped)',
              }}
            >
              {segment.japanese}
            </span>
            {/* Height is always reserved so revealing never reflows the card — only opacity animates. */}
            <span
              className="text-[12px] leading-[18px]"
              style={{
                height: 18,
                whiteSpace: 'nowrap',
                opacity: revealed ? 1 : 0,
                color: saved ? SAVED_COLOR : 'var(--color-neutral-500)',
                transition: 'opacity 260ms var(--ease-damped), color 200ms var(--ease-damped)',
              }}
            >
              {segment.korean}
            </span>
          </button>
        )
      })}
    </div>
  )
}
