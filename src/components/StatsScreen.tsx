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

const COUNT_UP_MS = 900

/** easeOutCubic — quick off the mark, settles gently on the final value. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * A stat figure that counts up on first paint. Motion UI's own stats-counters
 * component is behind a Motion+ membership, so this is the same idea built from
 * what's already in the project.
 *
 * The value is tweened through real intermediate numbers rather than handed to
 * NumberFlow as a single 0 → N jump. NumberFlow animates each digit column
 * independently, so a straight jump to a number like 11 or 22 spins both reels
 * in lockstep — it reads as "00 flips to 11", not as counting. Feeding it the
 * in-between values makes the digits actually count, and NumberFlow's own short
 * transition smooths the steps.
 */
function StatFigure({ value, label, delayMs }: { value: number; label: string; delayMs: number }) {
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
    <div className="flex flex-col gap-0.5">
      <NumberFlow
        className="text-[22px]"
        style={{ fontFamily: 'var(--font-body)', fontWeight: 600, lineHeight: 1.1 }}
        value={shown}
        // Short enough that each tweened step lands before the next frame —
        // the counting comes from the tween, not from NumberFlow's own timing.
        transformTiming={{ duration: 80, easing: 'linear' }}
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
    // Lora (--font-body) across the whole tab, including the heatmap's axis
    // labels and legend, which otherwise inherit the app's default face.
    <div className="flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="pt-2 pb-3">
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>
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
