import NumberFlow from '@number-flow/react'
import { useEffect, useState } from 'react'
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapLegend,
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

/**
 * A stat figure that counts up on first paint. Motion UI's own stats-counters
 * component is behind a Motion+ membership, so this is the same idea built from
 * what's already in the project: NumberFlow (installed alongside the heatmap)
 * for the ticking tabular figures, staggered so they don't all fire at once.
 */
function StatFigure({ value, label, delayMs }: { value: number; label: string; delayMs: number }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => setShown(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return (
    <div className="flex flex-col gap-0.5">
      <NumberFlow
        className="text-[22px]"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, lineHeight: 1.1 }}
        value={shown}
        transformTiming={{ duration: 900, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)' }}
        willChange
      />
      <span className="text-[11px]" style={{ color: 'var(--color-neutral-500)' }}>
        {label}
      </span>
    </div>
  )
}

/**
 * §10's progress view: a study heatmap over the last 26 weeks plus the handful
 * of aggregates §10 asks for. Non-gamified by spec — no streaks, no badges.
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
      <p className="mt-4 text-[13px]" style={{ color: 'var(--color-neutral-500)' }}>
        Loading stats…
      </p>
    )
  }

  const { heatmap } = stats

  return (
    <div className="flex flex-col">
      <div className="pt-2 pb-3">
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
          Study Activity
        </h2>
      </div>

      {stats.totalReviews === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--color-neutral-500)' }}>
          No reviews yet — finish a session and it'll show up here.
        </p>
      ) : (
        <>
          {/* Phone-only: `fluid` sizes the cells to whatever width is available, so
              all 26 weeks fit on screen with no horizontal scroll. Tight margins
              (vs. the component's 40/16 default) buy back pixels for the cells.
              No tooltip and no interactive cells — there's no hover on a phone,
              and this is meant to be a glance at the past, not something to poke. */}
          <div className="w-full">
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
          </div>

          <div className="mt-2 flex justify-end">
            {/* Same ramp as the cells — without this the legend falls back to the
                shadcn chart tokens and reads grey against the accent-coloured grid. */}
            <HeatmapLegend
              lessLabel="Less"
              moreLabel="More"
              colorScale={(level) => LEVEL_COLORS[Math.min(4, Math.max(0, Math.round(level ?? 0)))]}
            />
          </div>
        </>
      )}

      <div className="mt-7 border-t pt-5" style={{ borderColor: 'var(--color-divider)' }}>
        <div className="grid grid-cols-2 gap-y-5">
          <StatFigure
            value={stats.totalReviews}
            label={stats.totalReviews === 1 ? 'Sentence reviewed' : 'Sentences reviewed'}
            delayMs={0}
          />
          <StatFigure
            value={stats.activeDays}
            label={stats.activeDays === 1 ? 'Day studied' : 'Days studied'}
            delayMs={80}
          />
          <StatFigure value={stats.conceptsEncountered} label="Concepts seen" delayMs={160} />
          <StatFigure value={stats.conceptsKnown} label="Concepts known" delayMs={240} />
        </div>
      </div>

      <p className="mt-6 text-[11px]" style={{ color: 'var(--color-neutral-400)' }}>
        Last {HEATMAP_WEEKS} weeks. A darker square means more sentences reviewed that day.
      </p>
    </div>
  )
}
