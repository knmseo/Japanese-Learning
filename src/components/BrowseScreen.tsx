import { BookMarked, ChevronRight, Tag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDecks } from '@/lib/deckStore'
import { db } from '@/lib/db'
import type { Deck, StudySource } from '@/lib/types'

type Props = {
  /** Both screens stay mounted (§16), so counts refresh when this one becomes visible. */
  visible: boolean
  activeSource: StudySource | null
  onSelectSource: (source: StudySource) => void
}

const STROKE = '#312F2A'

function isActive(active: StudySource | null, candidate: StudySource): boolean {
  if (!active) return false
  if (active.kind !== candidate.kind) return false
  if (active.kind === 'deck' && candidate.kind === 'deck') return active.deckId === candidate.deckId
  return true
}

/**
 * §16's deck library. Decks come from the static JSON manifest; the two
 * saved sets come from the tables that tap-to-save and the card's star
 * already write to. Selecting any of them sets the study source, which
 * scopes the next session.
 */
export function BrowseScreen({ visible, activeSource, onSelectSource }: Props) {
  const [decks, setDecks] = useState<Deck[]>([])
  const [savedSentenceCount, setSavedSentenceCount] = useState(0)
  const [savedWordCount, setSavedWordCount] = useState(0)

  useEffect(() => {
    if (!visible) return
    void (async () => {
      setDecks(await getDecks())
      setSavedSentenceCount(await db.savedSentences.count())
      setSavedWordCount(await db.savedSegments.count())
    })()
  }, [visible])

  const savedRows: { source: StudySource; label: string; count: number; icon: React.ReactNode }[] = [
    {
      source: { kind: 'saved-sentences' },
      label: 'Saved sentences',
      count: savedSentenceCount,
      icon: <BookMarked className="size-4" style={{ color: 'var(--color-accent-700)' }} />,
    },
    {
      source: { kind: 'saved-words' },
      label: 'Saved words',
      count: savedWordCount,
      icon: <Tag className="size-4" style={{ color: 'var(--color-accent-700)' }} />,
    },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-6 pb-2">
      <p
        className="text-[11px] uppercase"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.08em' }}
      >
        Browse
      </p>

      <h2 className="mt-4 mb-3 text-[22px]" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
        Study Decks
      </h2>

      {decks.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--color-neutral-500)' }}>
          No decks found in public/decks/.
        </p>
      ) : (
        <div
          className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {decks.map((deck) => {
            const source: StudySource = { kind: 'deck', deckId: deck.id }
            const active = isActive(activeSource, source)
            return (
              <button
                key={deck.id}
                type="button"
                onClick={() => onSelectSource(source)}
                className="card flex-none text-left"
                style={{
                  width: 168,
                  minHeight: 104,
                  padding: '14px 14px 12px',
                  borderColor: STROKE,
                  borderBottomWidth: active ? 6 : 2,
                  background: active ? 'color-mix(in srgb, var(--color-accent-500) 12%, transparent)' : 'transparent',
                  justifyContent: 'space-between',
                }}
                aria-pressed={active}
              >
                <span className="text-[15px] leading-snug" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                  {deck.name}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--color-neutral-500)' }}>
                  {deck.sentenceCount} sentences
                  {active && ' · studying'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <h2 className="mt-7 mb-3 text-[22px]" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
        My Sentences
      </h2>

      <div className="flex flex-col gap-2.5">
        {savedRows.map((row) => {
          const active = isActive(activeSource, row.source)
          const empty = row.count === 0
          return (
            <button
              key={row.label}
              type="button"
              disabled={empty}
              onClick={() => onSelectSource(row.source)}
              className="card w-full flex-row items-center justify-between disabled:opacity-55"
              style={{
                padding: '14px 16px',
                borderColor: STROKE,
                borderBottomWidth: active ? 4 : 2,
                background: active ? 'color-mix(in srgb, var(--color-accent-500) 12%, transparent)' : 'transparent',
              }}
              aria-pressed={active}
            >
              <span className="flex items-center gap-2">
                {row.icon}
                <span className="text-[15px]" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                  {row.label}
                </span>
                <span className="text-[12px] tabular-nums" style={{ color: 'var(--color-neutral-500)' }}>
                  {row.count}
                </span>
              </span>
              {!empty && <ChevronRight className="size-4" style={{ color: 'var(--color-neutral-500)' }} />}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-[11px]" style={{ color: 'var(--color-neutral-400)' }}>
        Star a sentence, or tap a word after revealing, to collect it here.
      </p>
    </div>
  )
}
