import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { hashText } from '@/lib/hash'
import { isSegmentSaved, saveSegment } from '@/lib/savedSegments'
import { getOrCreateSegmentation } from '@/lib/segmentationGenerator'
import type { SentenceSegment } from '@/lib/types'

type Props = {
  japanese: string
  naturalKorean: string
}

/**
 * §15: shows the natural Korean translation immediately (already known
 * synchronously — it's the sentence's own `translation` field), then loads
 * the aligned, tappable segment breakdown underneath once generated/cached.
 * Reveal is never blocked on the segmentation LLM call.
 */
export function SegmentedTranslation({ japanese, naturalKorean }: Props) {
  const [segments, setSegments] = useState<SentenceSegment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [sourceHash, setSourceHash] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSegments(null)
    setError(null)
    setSavedKeys(new Set())

    void (async () => {
      const hash = await hashText(japanese)
      if (cancelled) return
      setSourceHash(hash)

      try {
        const segmentation = await getOrCreateSegmentation(japanese, naturalKorean)
        if (cancelled) return
        setSegments(segmentation.segments)

        const savedFlags = await Promise.all(
          segmentation.segments.map(async (s) => (await isSegmentSaved(s.japanese, hash)) ? s.japanese : null),
        )
        if (cancelled) return
        setSavedKeys(new Set(savedFlags.filter((v): v is string => v !== null)))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [japanese])

  async function handleTapSegment(segment: SentenceSegment) {
    if (!sourceHash || savedKeys.has(segment.japanese)) return
    await saveSegment(segment, sourceHash)
    setSavedKeys((prev) => new Set(prev).add(segment.japanese))
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[13px]" style={{ color: 'var(--color-neutral-500)' }}>
        {naturalKorean}
      </p>

      {error && <p className="text-destructive text-[11px]">Couldn't break this sentence into segments: {error}</p>}

      {!error && !segments && (
        <p className="text-[11px]" style={{ color: 'var(--color-neutral-400)' }}>
          Analyzing…
        </p>
      )}

      {segments && segments.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-2">
          {segments.map((segment, i) => {
            const saved = savedKeys.has(segment.japanese)
            return (
              <button
                key={`${segment.japanese}-${i}`}
                type="button"
                onClick={() => void handleTapSegment(segment)}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className="flex flex-col items-center rounded-sm px-1.5 py-1 transition-colors"
                style={{ background: saved ? 'var(--color-accent-100)' : 'transparent' }}
                aria-label={`Save ${segment.japanese}`}
              >
                <span
                  className="flex items-center gap-1"
                  style={{ fontFamily: '"Noto Sans JP", var(--font-body), sans-serif', fontSize: 16, color: 'var(--color-text)' }}
                >
                  {segment.japanese}
                  {saved && <Check className="size-3" style={{ color: 'var(--color-accent-700)' }} />}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--color-neutral-500)' }}>
                  {segment.korean}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
