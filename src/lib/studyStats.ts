import type { HeatmapColumn } from '@/components/charts/heatmap'
import { db } from './db'
import { deriveMasteryStatus } from './conceptMastery'

/**
 * §10's progress tracking. Deliberately minimal and non-gamified — §10 and
 * §14 both rule out streaks, leaderboards and achievement badges, so nothing
 * here rewards consecutive days; it just reports what happened.
 */

/** Sunday-first, matching the heatmap's default weekStartDay of 0. */
const DAYS_PER_WEEK = 7

/** How many weeks of history the heatmap shows. */
export const HEATMAP_WEEKS = 26

/**
 * Reviews-per-day → the heatmap's five visual levels. The component maps
 * `count` straight through (0→0, 1→1, 2→2, 3→3, 4+→4), which would saturate
 * instantly for this app — a default session is 10 sentences, so every study
 * day would look identical at max level. These buckets are scaled to session
 * size instead, and the tooltip still reports the true number.
 */
function levelForReviews(reviews: number): number {
  if (reviews <= 0) return 0
  if (reviews < 5) return 1
  if (reviews < 10) return 2
  if (reviews < 20) return 3
  return 4
}

/** Local-time day key (not UTC) — days should break where the user's day breaks. */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export type HeatmapModel = {
  columns: HeatmapColumn[]
  /** dayKey → true review count, for the tooltip (the grid itself carries levels). */
  reviewsByDay: Map<string, number>
}

/**
 * Builds the week-column grid the heatmap wants: one column per week, seven
 * day bins per column, ending on today's week. Days before the range start or
 * after today still get a cell (the grid is rectangular) with count 0.
 */
export function buildHeatmapModel(reviewsByDay: Map<string, number>, now = new Date()): HeatmapModel {
  const today = startOfDay(now)

  // Walk back to the Sunday that starts the earliest visible week.
  const firstDay = startOfDay(now)
  firstDay.setDate(firstDay.getDate() - (HEATMAP_WEEKS - 1) * DAYS_PER_WEEK - today.getDay())

  const columns: HeatmapColumn[] = []
  for (let week = 0; week < HEATMAP_WEEKS; week++) {
    const bins = []
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      const date = new Date(firstDay)
      date.setDate(firstDay.getDate() + week * DAYS_PER_WEEK + day)
      // Future days in the current week render as empty rather than as data.
      const reviews = date > today ? 0 : (reviewsByDay.get(dayKey(date)) ?? 0)
      bins.push({ bin: day, count: levelForReviews(reviews), date })
    }
    columns.push({ bin: week, bins })
  }

  return { columns, reviewsByDay }
}

export type StudyStats = {
  heatmap: HeatmapModel
  /** Distinct days with at least one review, within the heatmap window. */
  activeDays: number
  totalReviews: number
  conceptsEncountered: number
  conceptsKnown: number
  /** Sum of response latencies — the only listening-time signal actually logged. */
  minutesStudied: number
}

/** Reads everything §10 reports out of the tables the study loop already writes. */
export async function getStudyStats(now = new Date()): Promise<StudyStats> {
  const [logs, masteries] = await Promise.all([db.reviewLogs.toArray(), db.conceptMastery.toArray()])

  const reviewsByDay = new Map<string, number>()
  let totalLatencyMs = 0
  for (const log of logs) {
    const key = dayKey(new Date(log.timestamp))
    reviewsByDay.set(key, (reviewsByDay.get(key) ?? 0) + 1)
    totalLatencyMs += log.responseLatencyMs
  }

  const heatmap = buildHeatmapModel(reviewsByDay, now)

  // Count only days actually inside the visible window, so the number agrees
  // with what the grid shows rather than with all history.
  let activeDays = 0
  let totalReviews = 0
  for (const column of heatmap.columns) {
    for (const bin of column.bins) {
      const reviews = reviewsByDay.get(dayKey(bin.date)) ?? 0
      if (reviews > 0) {
        activeDays++
        totalReviews += reviews
      }
    }
  }

  return {
    heatmap,
    activeDays,
    totalReviews,
    conceptsEncountered: masteries.length,
    conceptsKnown: masteries.filter((m) => deriveMasteryStatus(m) === 'known').length,
    minutesStudied: Math.round(totalLatencyMs / 60000),
  }
}
