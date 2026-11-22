import { localDateKey, type ActionTask, type GoalWorkspace } from './model'
import type { CalendarExportItem } from './calendarExport'

export interface GoalAgendaItem {
  goalSpaceId: string
  goalName: string
  task: ActionTask
  dateKey: string
}

export interface GoalAgenda {
  startDate: string
  endDate: string
  items: GoalAgendaItem[]
}

export function buildTodayGoalActions(goalSpaces: GoalWorkspace[], activeGoalSpaceId: string, now = new Date()): GoalAgendaItem[] {
  const today = localDateKey(now)
  return goalSpaces.flatMap((workspace) => workspace.id === activeGoalSpaceId ? [] : workspace.tasks.flatMap((task) => {
    if (!task.scheduledAt || task.status === 'skipped') return []
    const startAt = new Date(task.scheduledAt)
    if (!Number.isFinite(startAt.getTime())) return []
    const dateKey = localDateKey(startAt)
    return dateKey === today ? [{ goalSpaceId: workspace.id, goalName: workspace.name, task, dateKey }] : []
  })).sort((a, b) => (a.task.scheduledAt || '').localeCompare(b.task.scheduledAt || '') || a.goalName.localeCompare(b.goalName))
}

/** Collects scheduled actions (including skipped ones for recovery) across all goals for a local Monday–Sunday week. */
export function buildGoalAgenda(goalSpaces: GoalWorkspace[], weekOffset = 0, now = new Date()): GoalAgenda {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(today)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + weekOffset * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const startDate = localDateKey(start)
  const endDate = localDateKey(end)
  const items = goalSpaces.flatMap((workspace) => workspace.tasks.flatMap((task) => {
    if (!task.scheduledAt) return []
    const startAt = new Date(task.scheduledAt)
    if (!Number.isFinite(startAt.getTime())) return []
    const dateKey = localDateKey(startAt)
    if (dateKey < startDate || dateKey > endDate) return []
    return [{ goalSpaceId: workspace.id, goalName: workspace.name, task, dateKey }]
  })).sort((a, b) => (a.task.scheduledAt || '').localeCompare(b.task.scheduledAt || '') || a.goalName.localeCompare(b.goalName))
  return { startDate, endDate, items }
}

export function buildAllGoalCalendarItems(goalSpaces: GoalWorkspace[]): CalendarExportItem[] {
  return goalSpaces.flatMap((workspace) => workspace.tasks
    .filter((task) => task.scheduledAt && task.status !== 'skipped')
    .map((task) => ({
      id: `${workspace.id}-${task.id}`,
      title: `[${workspace.name}] ${task.title}`,
      scheduledStart: task.scheduledAt!,
      durationMinutes: task.duration,
      description: `目标：${workspace.name}\n${task.doneWhen}\n证据：${task.evidence}`,
    })))
}
