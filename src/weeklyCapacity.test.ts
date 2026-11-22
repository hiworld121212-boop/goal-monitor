import { describe, expect, it } from 'vitest'
import { demoState, type ActionTask, type GoalWorkspace } from './model'
import { buildWeeklyCapacitySummary } from './weeklyCapacity'

const task = (id: string, scheduledAt: string, duration: number, status: ActionTask['status'] = 'planned'): ActionTask => ({
  id, title: id, time: '', duration, doneWhen: '', evidence: '', status, kind: 'build', scheduledAt,
})

describe('weekly focus capacity', () => {
  const now = new Date(2026, 10, 25, 12)
  const workspace = (id: string, tasks: ActionTask[]): GoalWorkspace => ({ ...demoState.goalSpaces[0], id, tasks })

  it('totals valid, non-skipped focus blocks across goals in the local week', () => {
    const summary = buildWeeklyCapacitySummary([
      workspace('career', [task('mon', '2026-11-23T08:00', 30), task('skip', '2026-11-24T08:00', 90, 'skipped'), task('outside', '2026-11-30T08:00', 45), task('invalid', 'bad', 60)]),
      workspace('health', [task('wed', '2026-11-25T18:00', 25, 'confirmed'), task('sun', '2026-11-29T20:00', 40)]),
    ], 120, now)
    expect(summary).toEqual({ startDate: '2026-11-23', endDate: '2026-11-29', scheduledMinutes: 95, scheduledCount: 3, budgetMinutes: 120 })
  })

  it('treats invalid or missing budget as unset and clamps excessive values', () => {
    const none = buildWeeklyCapacitySummary([], Number.NaN, now)
    expect(none.budgetMinutes).toBe(0)
    expect(buildWeeklyCapacitySummary([], 9000, now).budgetMinutes).toBe(3000)
  })
})
