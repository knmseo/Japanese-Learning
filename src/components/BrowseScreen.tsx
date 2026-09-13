import { BookMarked, Tag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PressableButton } from '@/components/PressableButton'
import { SavedWordsOverlay } from '@/components/SavedWordsOverlay'
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

/** Every 2px outline and the slab beneath tiles and rows (DESIGN.md → Tokens). */
const INK = 'var(--color-ink)'
/** The design frame is 402 wide; the column caps there and centres beyond it. */
const FRAME_WIDTH = 402

/* Deck tiles — 185×129, radius 12, on a 4px slab. The two rails scroll
 * independently and the second is offset 90px so the tiles never line up into
 * a grid; cards sit cropped at the frame edge instead. */
const TILE_WIDTH = 185
const TILE_HEIGHT = 129
const RAIL_GAP = 15
const ROW_OFFSET = 90
/** Keeps the first tile of each rail off the frame edge at scroll 0. (The
 * mockup draws row 1 already scrolled, starting at x -53, so it specifies the
 * 90px stagger between rows but not a resting inset.) */
const RAIL_INSET = 16
const TILE_DEPTH = 4
/** Vertical room a rail needs below its tiles for the slab and the press travel.
 * `overflow-x: auto` forces overflow-y to `auto` too, so without this the slab
 * is clipped at rest and the press animation's drop with it. */
const RAIL_PRESS_ROOM = 6

/* Saved rows — 335×60, radius 20, on a 5px slab. */
const ROW_INSET = 34
const ROW_HEIGHT = 60
const ROW_DEPTH = 5

/** Selected deck or saved row: the flat teal, held in the pressed position.
 * (Momentary presses go yellow via --color-press; a persistent yellow would
 * read as a button stuck down rather than a toggle that is on.) */
const SELECTED_FILL = 'var(--color-accent-500)'

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
  /** Saved Words opens a review overlay rather than scoping a study session —
   * the words are for looking over and hearing, not for rating. */
  const [savedWordsOpen, setSavedWordsOpen] = useState(false)

  useEffect(() => {
    if (!visible || savedWordsOpen) return
    void (async () => {
      setDecks(await getDecks())
      setSavedSentenceCount(await db.savedSentences.count())
      setSavedWordCount(await db.savedSegments.count())
    })()
  }, [visible, savedWordsOpen])

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

  // The mockup draws these rows as label + count only, but the icons earn their
  // place as the row's quickest identifier, so they stay — tinted with the same
  // --color-icon the card's own glyphs use.
  const savedRows: {
    source: StudySource
    label: string
    count: number
    icon: React.ReactNode
    /** Saved Sentences scopes a session; Saved Words opens the review overlay. */
    onPress: () => void
  }[] = [
    {
      source: { kind: 'saved-sentences' },
      label: 'Saved Sentences',
      count: savedSentenceCount,
      icon: <BookMarked className="size-[18px]" style={{ color: 'var(--color-icon)' }} />,
      onPress: () => onSelectSource({ kind: 'saved-sentences' }),
    },
    {
      source: { kind: 'saved-words' },
      label: 'Saved Words',
      count: savedWordCount,
      icon: <Tag className="size-[18px]" style={{ color: 'var(--color-icon)' }} />,
      onPress: () => setSavedWordsOpen(true),
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
        className="shrink-0"
        // Every tile rests raised on the same depth; the selected one is held in
        // the pressed position, so the rail reads as a row of toggle buttons
        // with one pushed in.
        restDepthPx={TILE_DEPTH}
        depressed={active}
        shadowColor={INK}
        pressedBackground={SELECTED_FILL}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'stretch',
          width: TILE_WIDTH,
          height: TILE_HEIGHT,
          // Name sits 18/13 in from the top-left, the count 20/22 from the
          // bottom-right — the tile's own padding carries both.
          padding: '13px 20px 22px 18px',
          textAlign: 'left',
          background: 'var(--color-surface)',
          border: `2px solid ${INK}`,
          borderRadius: 'var(--radius-tile)',
        }}
        aria-pressed={active}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            fontSize: 15,
            lineHeight: 1.25,
            color: 'var(--color-text)',
          }}
        >
          {deck.name}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            fontSize: 10,
            textAlign: 'right',
            color: 'var(--color-neutral-400)',
          }}
        >
          {deck.sentenceCount} sentences
        </span>
      </PressableButton>
    )
  }

  return (
    <div
      className="flex flex-1 flex-col items-center overflow-y-auto pt-6"
      // Clears the screen toggle the same way the rating buttons do — 96px was
      // short enough that the Stats tab's trailing caption ran under it.
      style={{ paddingBottom: 'calc(128px + env(safe-area-inset-bottom))' }}
    >
      <div className="w-full" style={{ maxWidth: FRAME_WIDTH }}>
        <p
          className="uppercase"
          style={{
            paddingLeft: 24,
            fontFamily: 'var(--font-heading)',
            fontWeight: 'var(--font-heading-weight)' as unknown as number,
            fontSize: 18,
            color: 'var(--color-text)',
          }}
        >
          Browse
        </p>

        {/* One shared underline that slides between the tabs, rather than a border
            per button that would pop on/off. Measured from the buttons themselves so
            it matches each label's real width. */}
        <div
          className="relative mt-3 flex"
          style={{ marginInline: 22, gap: 16, borderBottom: '1px solid var(--color-divider)' }}
        >
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
                className="capitalize"
                style={{
                  paddingInline: 3,
                  paddingBottom: 6,
                  fontFamily: 'var(--font-heading)',
                  // Active is the Bold cut in black, inactive the Regular in grey.
                  fontWeight: active ? 700 : 400,
                  fontSize: 12,
                  color: active ? 'var(--color-text)' : 'var(--color-neutral-500)',
                  transition: 'color 320ms var(--ease-damped), font-weight 320ms var(--ease-damped)',
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
              background: INK,
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
            <div style={{ paddingLeft: 32, paddingTop: 17, paddingBottom: 14 }}>
              <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 20, margin: 0 }}>
                Study Decks
              </h2>
            </div>

            {decks.length === 0 ? (
              <p style={{ paddingLeft: 32, fontSize: 13, color: 'var(--color-neutral-500)' }}>
                No decks found in public/decks/.
              </p>
            ) : (
              // Outer gap is reduced by RAIL_PRESS_ROOM because each rail carries that
              // much bottom padding — keeps the visual gap between rows unchanged.
              <div className="flex flex-col" style={{ gap: 14 - RAIL_PRESS_ROOM }}>
                {rows.map((row, rowIndex) =>
                  row.length === 0 ? null : (
                    <div
                      key={rowIndex}
                      className="overflow-x-auto"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                    >
                      {/* pr keeps the last tile from butting against the frame; the
                          second row's extra leading pad staggers it against the first. */}
                      <div
                        className="flex w-max"
                        style={{
                          gap: RAIL_GAP,
                          paddingLeft: RAIL_INSET + (rowIndex === 1 ? ROW_OFFSET : 0),
                          paddingRight: 16,
                          paddingBottom: RAIL_PRESS_ROOM,
                        }}
                      >
                        {row.map(deckCard)}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            <div style={{ paddingLeft: 32, paddingTop: 41, paddingBottom: 17 }}>
              <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 20, margin: 0 }}>Saved</h2>
            </div>

            <div className="flex flex-col" style={{ marginInline: ROW_INSET, gap: 20 - ROW_DEPTH }}>
              {savedRows.map((row) => {
                // Saved Words never reads as "currently studying" — it isn't a
                // study source any more, it opens the overlay.
                const active = row.source.kind === 'saved-words' ? false : isActive(activeSource, row.source)
                const empty = row.count === 0
                return (
                  <PressableButton
                    key={row.label}
                    type="button"
                    disabled={empty}
                    onClick={row.onPress}
                    className="w-full"
                    // Same toggle behaviour as the deck tiles above — selected stays
                    // pushed in — so the two halves of this screen don't read opposite.
                    restDepthPx={ROW_DEPTH}
                    depressed={active}
                    shadowColor={INK}
                    pressedBackground={SELECTED_FILL}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: ROW_HEIGHT,
                      // The mockup insets the label 39px and the count 20px; with
                      // the icon restored the label lands at ~44 instead.
                      padding: '0 20px 0 16px',
                      background: 'var(--color-surface)',
                      border: `2px solid ${INK}`,
                      borderRadius: 'var(--radius-card)',
                    }}
                    aria-pressed={active}
                  >
                    {/* An empty set stays fully drawn — the mockup shows both rows at
                        zero, outlined and slabbed — and only its contents dim, so the
                        row still reads as a real control rather than a grey smear. */}
                    <span
                      className="flex items-center"
                      style={{ gap: 10, opacity: empty ? 0.45 : 1 }}
                    >
                      {row.icon}
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 18 }}>
                        {row.label}
                      </span>
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 15,
                        color: 'var(--color-neutral-500)',
                        opacity: empty ? 0.45 : 1,
                      }}
                    >
                      {row.count}
                    </span>
                  </PressableButton>
                )
              })}
            </div>

            <p
              style={{
                marginTop: 14,
                paddingInline: ROW_INSET,
                fontSize: 11,
                color: 'var(--color-neutral-400)',
              }}
            >
              Star a sentence, or tap a word after revealing, to collect it here.
            </p>
          </>
        )}
      </div>

      <SavedWordsOverlay open={savedWordsOpen} onClose={() => setSavedWordsOpen(false)} />
    </div>
  )
}
