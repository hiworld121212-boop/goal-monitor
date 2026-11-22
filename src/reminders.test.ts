import { describe, expect, it } from 'vitest'
import { defaultReminderPreferences } from './model'
import { getDueReminders } from './reminders'

describe('local reminder scheduler', () => {
  const enabled = { ...defaultReminderPreferences, enabled: true }

  it('notifies once the focus lead time is reached and ignores completed tasks', () => {
    const task = { id: 'a', title: 'Build a demo', time: '', duration: 30, doneWhen: '', evidence: '', status: 'planned' as const, kind: 'build' as const, scheduledAt: '2026-11-23T18:30' }
    expect(getDueReminders(new Date(2026, 10, 23, 18, 19), [task], { ...enabled, focusLeadMinutes: 10 })).toHaveLength(0)
    expect(getDueReminders(new Date(2026, 10, 23, 18, 20), [task], { ...enabled, focusLeadMinutes: 10 })[0].key).toContain('focus:a:')
    expect(getDueReminders(new Date(2026, 10, 23, 18, 24), [task], { ...enabled, focusLeadMinutes: 10 })).toHaveLength(1)
    expect(getDueReminders(new Date(2026, 10, 23, 18, 26), [task], { ...enabled, focusLeadMinutes: 10 })).toHaveLength(0)
    expect(getDueReminders(new Date(2026, 10, 23, 18, 20), [{ ...task, status: 'confirmed' }], { ...enabled, focusLeadMinutes: 10 })).toHaveLength(0)
  })

  it('uses local weekday and time for daily and weekly review reminders', () => {
    const preferences = { ...enabled, dailyReviewTime: '20:30', weeklyReviewDay: 1, weeklyReviewTime: '20:30' }
    expect(getDueReminders(new Date(2026, 10, 23, 20, 33), [], preferences).map((item) => item.key)).toEqual(['daily:2026-11-23', 'weekly:2026-11-23'])
    expect(getDueReminders(new Date(2026, 10, 24, 20, 33), [], preferences).map((item) => item.key)).toEqual(['daily:2026-11-24'])
  })

  it('identifies the goal workspace for a cross-goal focus reminder', () => {
    const task = { id: 'walk', title: '午休散步', time: '', duration: 10, doneWhen: '', evidence: '', status: 'planned' as const, kind: 'build' as const, scheduledAt: '2026-11-23T18:30', goalSpaceId: 'health', goalName: '健康' }
    const reminder = getDueReminders(new Date(2026, 10, 23, 18, 20), [task], enabled)[0]
    expect(reminder.body).toBe('健康 · 午休散步')
    expect(reminder.goalSpaceId).toBe('health')
  })

  it('deduplicates task reminders independently when different goals reuse a task id', () => {
    const task = { id: 'same-id', title: 'Focus', time: '', duration: 10, doneWhen: '', evidence: '', status: 'planned' as const, kind: 'build' as const, scheduledAt: '2026-11-23T18:30' }
    const reminders = getDueReminders(new Date(2026, 10, 23, 18, 20), [
      { ...task, goalSpaceId: 'career', goalName: '职业' },
      { ...task, goalSpaceId: 'health', goalName: '健康' },
    ], enabled)
    expect(reminders).toHaveLength(2)
    expect(new Set(reminders.map((reminder) => reminder.key)).size).toBe(2)
  })

  it('does not create reminders while disabled or after the short delivery window', () => {
    expect(getDueReminders(new Date(2026, 10, 23, 20, 33), [], defaultReminderPreferences)).toHaveLength(0)
    expect(getDueReminders(new Date(2026, 10, 23, 20, 36), [], { ...enabled, dailyReviewTime: '20:30' })).toHaveLength(0)
  })
})
