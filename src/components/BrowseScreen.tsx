import { BookMarked, ChevronRight, Tag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PressableButton } from '@/components/PressableButton'
import { SettingsScreen } from '@/components/SettingsScreen'
import { StatsScreen } from '@/components/StatsScreen'
import { getDecks } from '@/lib/deckStore'
import { db } from '@/lib/db'
import type { Deck, StudySource } from '@/lib/types'

type Props = {
  /** Both screens stay mounted (§16), so counts refresh when this one becomes visible. */
  visible: boolean
  activeSource: StudySource | null
  onSelectSource: (source: StudySource) => void
}

/** Outline + heavy bottom edge share one token, so dark mode shifts both
 * off near-black together (#312F2A light, #4F6260 dark). */
const STROKE = 'var(--color-shadow)'
const CARD_WIDTH = 168
const RAIL_GAP = 12
/** The second rail starts half a card further along, so the two rows never line
 * up into a grid — cards sit cropped at the frame edge instead. */
const ROW_OFFSET = 74
/** Vertical room a deck card needs below its box for the thick bottom edge and the
 * press animation's travel — the deepest rest shadow is 4px (an active deck). */
const CARD_PRESS_ROOM = 6
/** Resting depth of every deck card — selected ones sink to 0 from here. */
const DECK_PRESS_DEPTH = 4
/** Fill for a pressed/selected deck. Softer than the default solid accent, which
 * as a persistent state would turn the selected card into a solid block. */
const DECK_SELECTED_TINT = 'color-mix(in srgb, var(--color-accent-500) 24%, transparent)'

type TabId = 'library' | 'stats' | 'settings'
const TABS: TabId[] = ['library', 'stats', 'settings']

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
  const [tab, setTab] = useState<TabId>('library')
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ library: null, stats: null, settings: null })
  const [underline, setUnderline] = useState({ left: 0, width: 0 })
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

  /** Track the active tab button's position so the shared underline can slide to it.
   * Re-measured when the tab changes or the pane becomes visible (widths are 0
   * while the pane is off-screen, so the first measure has to wait for that). */
  useEffect(() => {
    const el = tabRefs.current[tab]
    if (!el) return
    setUnderline({ left: el.offsetLeft, width: el.offsetWidth })
  }, [tab, visible])

  /** Deal the decks alternately into two rows. Each row scrolls on its own, and
   * any number of decks distributes evenly — nothing is capped at six. */
  const rows: Deck[][] = [
    decks.filter((_, i) => i % 2 === 0),
    decks.filter((_, i) => i % 2 === 1),
  ]

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

  function deckCard(deck: Deck) {
    const source: StudySource = { kind: 'deck', deckId: deck.id }
    const active = isActive(activeSource, source)
    return (
      <PressableButton
        key={deck.id}
        type="button"
        onClick={() => onSelectSource(source)}
        className="card shrink-0 text-left"
        // Every deck rests raised on the same depth; the selected one is held
        // in the pressed state, so the rail reads as a row of toggle buttons
        // with one pushed in. (It used to be inverted — only the selected deck
        // looked raised, so the whole rail read as "pressed" by default.)
        restDepthPx={DECK_PRESS_DEPTH}
        depressed={active}
        shadowColor="var(--color-shadow)"
        pressedBackground={DECK_SELECTED_TINT}
        style={{
          width: CARD_WIDTH,
          minHeight: 92,
          padding: '12px 13px 11px',
          borderColor: STROKE,
          background: 'transparent',
          justifyContent: 'space-between',
        }}
        aria-pressed={active}
      >
        <span
          className="text-[14px] leading-snug"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          {deck.name}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--color-neutral-500)' }}>
          {deck.sentenceCount} sentences
          {active && ' · studying'}
        </span>
      </PressableButton>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-6 pb-24">
      <p
        className="text-[11px] uppercase"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.08em' }}
      >
        Browse
      </p>

      {/* One shared underline that slides between the tabs, rather than a border
          per button that would pop on/off. Measured from the buttons themselves so
          it matches each label's real width. */}
      <div className="relative mt-4 flex gap-5" style={{ borderBottom: '1px solid var(--color-divider)' }}>
        {TABS.map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[t] = el
              }}
              type="button"
              onClick={() => setTab(t)}
              aria-current={active}
              className="pb-2 text-[15px] capitalize"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                color: active ? 'var(--color-text)' : 'var(--color-neutral-500)',
                transition: 'color 320ms var(--ease-damped)',
              }}
            >
              {t}
            </button>
          )
        })}
        <span
          aria-hidden
          className="absolute bottom-0 block"
          style={{
            height: 2,
            background: STROKE,
            width: underline.width,
            transform: `translateX(${underline.left}px)`,
            marginBottom: -1,
            // Same damped curve as the rest of the app, so the underline overshoots
            // slightly and settles rather than sliding linearly into place.
            transition: 'transform 420ms var(--ease-damped), width 420ms var(--ease-damped)',
            // Nothing to show until the first measurement lands.
            opacity: underline.width ? 1 : 0,
          }}
        />
      </div>

      {tab === 'settings' ? (
        <SettingsScreen visible={visible && tab === 'settings'} />
      ) : tab === 'stats' ? (
        <StatsScreen visible={visible && tab === 'stats'} />
      ) : (
        <>
      {/* Spacing lives on the wrapper: classical.css's `.classical h2` margin rule
          out-specifies Tailwind's margin utilities on the heading itself. */}
      <div className="pt-7 pb-1">
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
          Study Decks
        </h2>
      </div>

      {decks.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--color-neutral-500)' }}>
          No decks found in public/decks/.
        </p>
      ) : (
        // Outer gap is reduced by CARD_PRESS_ROOM because each rail now carries that
        // much bottom padding — keeps the visual gap between rows unchanged.
        <div className="-mx-4 flex flex-col" style={{ gap: RAIL_GAP - CARD_PRESS_ROOM }}>
          {rows.map((row, rowIndex) =>
            row.length === 0 ? null : (
              <div
                key={rowIndex}
                className="overflow-x-auto"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
              >
                {/* pr keeps the last card from butting against the frame; the second
                    row's extra leading pad staggers it against the first.
                    paddingBottom is what keeps the card's thick bottom edge visible:
                    `overflow-x: auto` forces overflow-y to `auto` too, so this rail
                    clips vertically — without the padding the shadow slab is cut off
                    at rest, and the press animation's downward travel with it. */}
                <div
                  className="flex w-max pr-4"
                  style={{
                    gap: RAIL_GAP,
                    paddingLeft: rowIndex === 1 ? ROW_OFFSET : 16,
                    paddingBottom: CARD_PRESS_ROOM,
                  }}
                >
                  {row.map(deckCard)}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <div className="pt-12">
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
          Saved
        </h2>
      </div>

      <div className="flex flex-col gap-2.5">
        {savedRows.map((row) => {
          const active = isActive(activeSource, row.source)
          const empty = row.count === 0
          return (
            <PressableButton
              key={row.label}
              type="button"
              disabled={empty}
              onClick={() => onSelectSource(row.source)}
              className="card w-full flex-row items-center justify-between disabled:opacity-55"
              // Same toggle behaviour as the deck cards above — selected stays
              // pushed in — so the two halves of this screen don't read opposite.
              restDepthPx={DECK_PRESS_DEPTH}
              depressed={active}
              shadowColor="var(--color-shadow)"
              pressedBackground={DECK_SELECTED_TINT}
              style={{
                // `.card`'s column direction ties with Tailwind's `flex-row` on
                // specificity and wins on source order — pin it here.
                flexDirection: 'row',
                padding: '14px 16px',
                borderColor: STROKE,
                background: 'transparent',
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
            </PressableButton>
          )
        })}
      </div>

      <p className="mt-3 text-[11px]" style={{ color: 'var(--color-neutral-400)' }}>
        Star a sentence, or tap a word after revealing, to collect it here.
      </p>
        </>
      )}
    </div>
  )
}
