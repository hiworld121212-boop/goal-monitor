import { localDateKey, type ActionTask, type ReminderPreferences } from './model'

export interface DueReminder {
  key: string
  title: string
  body: string
  goalSpaceId?: string
}

export type ReminderTask = ActionTask & { goalSpaceId?: string; goalName?: string }

/** Returns reminders due within a small polling window in the browser's local timezone. */
export function getDueReminders(
  now: Date,
  tasks: ReminderTask[],
  preferences: ReminderPreferences,
): DueReminder[] {
  if (!preferences.enabled) return []
  const due: DueReminder[] = []
  const currentDate = localDateKey(now)
  const minute = now.getMinutes()

  for (const task of tasks) {
    if (!task.scheduledAt || task.status === 'confirmed' || task.status === 'skipped') continue
    const start = new Date(task.scheduledAt)
    if (!Number.isFinite(start.getTime()) || localDateKey(start) !== currentDate) continue
    const fireAt = start.getTime() - preferences.focusLeadMinutes * 60_000
    const delta = now.getTime() - fireAt
    if (delta >= 0 && delta < 5 * 60_000) {
      due.push({
        key: `focus:${task.goalSpaceId ? `${task.goalSpaceId}:` : ''}${task.id}:${task.scheduledAt}`,
        title: '专注块即将开始',
        body: `${task.goalName ? `${task.goalName} · ` : ''}${task.title}`,
        goalSpaceId: task.goalSpaceId,
      })
    }
  }

  const scheduledMinute = (value: string) => {
    const [hour, min] = value.split(':').map(Number)
    return hour * 60 + min
  }
  const currentMinute = now.getHours() * 60 + minute
  const withinFiveMinutes = (target: string) => currentMinute >= scheduledMinute(target) && currentMinute < scheduledMinute(target) + 5
  if (withinFiveMinutes(preferences.dailyReviewTime)) {
    due.push({ key: `daily:${currentDate}`, title: '日终回顾', body: '花几分钟记录今天的成果、障碍和下一步。' })
  }
  if (now.getDay() === preferences.weeklyReviewDay && withinFiveMinutes(preferences.weeklyReviewTime)) {
    due.push({ key: `weekly:${currentDate}`, title: '每周复盘', body: '对照本周检查点，选出下周的一项调整。' })
  }
  return due
}
