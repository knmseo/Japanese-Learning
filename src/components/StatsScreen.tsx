import NumberFlow from '@number-flow/react'
import { useEffect, useState } from 'react'
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapXAxis,
  HeatmapYAxis,
} from '@/components/charts/heatmap'
import { getStudyStats, HEATMAP_WEEKS, type StudyStats } from '@/lib/studyStats'

type Props = {
  /** Both Browse sub-tabs stay mounted, so stats refresh when this becomes visible. */
  visible: boolean
}

/** The heatmap's five levels, in the app's accent ramp instead of the shadcn chart tokens. */
const LEVEL_COLORS: readonly [string, string, string, string, string] = [
  'var(--color-neutral-200)',
  'var(--color-accent-200)',
  'var(--color-accent-300)',
  'var(--color-accent-500)',
  'var(--color-accent-700)',
]

/* Geometry from the `BrowseTab - Stats` frame (DESIGN.md → Screens). */
const PANEL_INSET = 26
const PANEL_HEIGHT = 214
const TILE_HEIGHT = 82
const TILE_INSET = 38
const TILE_COLUMN_GAP = 34
const TILE_ROW_GAP = 43
const TILE_DEPTH = 4
/** The soft ambient shadow both the panel and the tiles carry, under the tiles'
 * own hard slab. */
const AMBIENT = '0 2px 5px 1px rgba(0, 0, 0, 0.1)'

const COUNT_UP_MS = 900

/** easeOutCubic — quick off the mark, settles gently on the final value. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * One of the four coloured stat tiles: a 146×82 panel on a 2px #444144 outline
 * and a matching 4px slab, with the figure centred in Cafe24 Moyamoya at 35px
 * and the caption in Lora beneath it.
 *
 * The figure counts up on first paint. Motion UI's own stats-counters component
 * is behind a Motion+ membership, so this is the same idea built from what's
 * already in the project.
 *
 * The value is tweened through real intermediate numbers rather than handed to
 * NumberFlow as a single 0 → N jump. NumberFlow animates each digit column
 * independently, so a straight jump to a number like 11 or 22 spins both reels
 * in lockstep — it reads as "00 flips to 11", not as counting. Feeding it the
 * in-between values makes the digits actually count, and NumberFlow's own short
 * transition smooths the steps.
 */
function StatTile({
  value,
  label,
  delayMs,
  fill,
}: {
  value: number
  label: string
  delayMs: number
  fill: string
}) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (value === 0) return

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setShown(value)
      return
    }

    let frame = 0
    let start = 0
    const startTimer = setTimeout(() => {
      const step = (now: number) => {
        start ||= now
        const progress = Math.min(1, (now - start) / COUNT_UP_MS)
        setShown(Math.round(easeOut(progress) * value))
        if (progress < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }, delayMs)

    return () => {
      clearTimeout(startTimer)
      cancelAnimationFrame(frame)
    }
  }, [value, delayMs])

  return (
    <div>
      <div
        className="flex items-center justify-center"
        style={{
          height: TILE_HEIGHT,
          background: fill,
          border: '2px solid var(--color-stat-edge)',
          borderRadius: 'var(--radius-panel)',
          boxShadow: `0 ${TILE_DEPTH}px 0 0 var(--color-stat-edge), ${AMBIENT}`,
        }}
      >
        <NumberFlow
          style={{ fontFamily: 'var(--font-numeral)', fontSize: 35, lineHeight: 1, color: 'var(--color-stat-figure)' }}
          value={shown}
          // Short enough that each tweened step lands before the next frame —
          // the counting comes from the tween, not from NumberFlow's own timing.
          transformTiming={{ duration: 80, easing: 'linear' }}
          willChange
        />
      </div>
      <p
        className="text-center"
        style={{
          // 10px below the tile, clearing its 4px slab first.
          marginTop: TILE_DEPTH + 10,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: 12,
          color: 'var(--color-text)',
        }}
      >
        {label}
      </p>
    </div>
  )
}

/**
 * §10's progress view: a study heatmap over the last 26 weeks plus the
 * aggregates §10 asks for. Non-gamified by spec — no streaks, no badges.
 */
export function StatsScreen({ visible }: Props) {
  const [stats, setStats] = useState<StudyStats | null>(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void getStudyStats().then((s) => {
      if (!cancelled) setStats(s)
    })
    return () => {
      cancelled = true
    }
  }, [visible])

  if (!stats) {
    return (
      <p style={{ marginTop: 28, paddingInline: PANEL_INSET, fontSize: 13, color: 'var(--color-neutral-500)' }}>
        Loading stats…
      </p>
    )
  }

  const { heatmap } = stats

  return (
    <div className="flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      {/* The heatmap's container: a plain white panel with no outline and only the
          soft ambient shadow — the one surface in the app that isn't slabbed. The
          mockup draws it empty, so what goes inside it is not specified. */}
      <div
        style={{
          marginTop: 28,
          marginInline: PANEL_INSET,
          minHeight: PANEL_HEIGHT,
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-panel)',
          boxShadow: AMBIENT,
          padding: '14px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {stats.totalReviews === 0 ? (
          <p className="text-center" style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
            No reviews yet — finish a session and it'll show up here.
          </p>
        ) : (
          // Phone-only: `fluid` sizes the cells to whatever width is available, so
          // all 26 weeks fit on screen with no horizontal scroll. No tooltip and no
          // interactive cells — there's no hover on a phone, and this is meant to be
          // a glance at the past, not something to poke.
          <HeatmapChart
            data={heatmap.columns}
            layout="fluid"
            gap={2}
            margin={{ top: 22, right: 2, bottom: 0, left: 20 }}
            levelColors={LEVEL_COLORS}
            weekStartDay={0}
            animate={false}
          >
            <HeatmapCells cornerRadius={1.5} interactive={false} />
            <HeatmapXAxis />
            <HeatmapYAxis tickFilter="odd" labelFormat="initial" />
          </HeatmapChart>
        )}
      </div>

      {/* Four tiles, 2×2, each hue mapped to the figure the mockup pairs it with. */}
      <div
        className="grid grid-cols-2"
        style={{
          marginTop: 43,
          paddingInline: TILE_INSET,
          columnGap: TILE_COLUMN_GAP,
          rowGap: TILE_ROW_GAP,
        }}
      >
        <StatTile
          value={stats.totalReviews}
          label={stats.totalReviews === 1 ? 'Sentence Reviewed' : 'Sentences Reviewed'}
          delayMs={0}
          fill="var(--color-stat-teal)"
        />
        <StatTile
          value={stats.activeDays}
          label={stats.activeDays === 1 ? 'Day Studied' : 'Days Studied'}
          delayMs={80}
          fill="var(--color-stat-salmon)"
        />
        <StatTile
          value={stats.conceptsEncountered}
          label="Concepts Seen"
          delayMs={160}
          fill="var(--color-stat-green)"
        />
        <StatTile
          value={stats.sessionsCompleted}
          label={stats.sessionsCompleted === 1 ? 'Session Done' : 'Sessions Done'}
          delayMs={240}
          fill="var(--color-stat-yellow)"
        />
        {/* Four tiles, exactly as drawn. `conceptsKnown` is still computed in
            studyStats — it just isn't surfaced here. */}
      </div>

      <p
        style={{
          marginTop: 28,
          paddingInline: TILE_INSET,
          fontSize: 11,
          color: 'var(--color-neutral-400)',
        }}
      >
        Last {HEATMAP_WEEKS} weeks. A darker square means more sentences reviewed that day.
      </p>
    </div>
  )
}
