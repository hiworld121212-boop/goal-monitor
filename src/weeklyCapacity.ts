import { localDateKey, type GoalWorkspace } from './model'

export interface WeeklyCapacitySummary {
  startDate: string
  endDate: string
  scheduledMinutes: number
  scheduledCount: number
  budgetMinutes: number
}

/** Totals scheduled focus blocks across all goals for the local Monday–Sunday week. */
export function buildWeeklyCapacitySummary(goalSpaces: GoalWorkspace[], budgetMinutes: number, now = new Date()): WeeklyCapacitySummary {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const startDate = localDateKey(start)
  const endDate = localDateKey(end)
  const scheduled = goalSpaces.flatMap((workspace) => workspace.tasks.flatMap((task) => {
    if (!task.scheduledAt || task.status === 'skipped') return []
    const date = new Date(task.scheduledAt)
    if (!Number.isFinite(date.getTime())) return []
    const dateKey = localDateKey(date)
    if (dateKey < startDate || dateKey > endDate) return []
    return [Math.max(0, Number.isFinite(task.duration) ? task.duration : 0)]
  }))
  return {
    startDate,
    endDate,
    scheduledMinutes: scheduled.reduce((sum, minutes) => sum + minutes, 0),
    scheduledCount: scheduled.length,
    budgetMinutes: Number.isFinite(budgetMinutes) && budgetMinutes > 0 ? Math.min(3000, Math.round(budgetMinutes)) : 0,
  }
}
