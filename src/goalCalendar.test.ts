import { describe, expect, it } from 'vitest'
import { demoState, type ActionTask, type GoalWorkspace } from './model'
import { buildAllGoalCalendarItems, buildGoalAgenda, buildTodayGoalActions } from './goalCalendar'
import { exportCalendarToIcs } from './calendarExport'

const task = (id: string, scheduledAt: string, status: ActionTask['status'] = 'planned'): ActionTask => ({
  id, title: id, time: '', duration: 30, doneWhen: '', evidence: '', status, kind: 'build', scheduledAt,
})

describe('multi-goal weekly calendar agenda', () => {
  const workspace = (id: string, name: string, tasks: ActionTask[]): GoalWorkspace => ({ ...demoState.goalSpaces[0], id, name, tasks })
  const now = new Date(2026, 10, 25, 12)

  it('collects events from each goal in local Monday-to-Sunday order', () => {
    const agenda = buildGoalAgenda([
      workspace('career', '职业', [task('wed', '2026-11-25T18:00'), task('before', '2026-11-22T18:00')]),
      workspace('health', '健康', [task('mon', '2026-11-23T08:00'), task('sun', '2026-11-29T20:00')]),
    ], 0, now)
    expect(agenda.startDate).toBe('2026-11-23')
    expect(agenda.endDate).toBe('2026-11-29')
    expect(agenda.items.map((item) => item.task.id)).toEqual(['mon', 'wed', 'sun'])
    expect(agenda.items.map((item) => item.goalName)).toEqual(['健康', '职业', '健康'])
  })

  it('keeps skipped items visible for recovery, excludes unscheduled tasks, and navigates by whole local weeks', () => {
    const current = workspace('career', '职业', [task('skipped', '2026-11-25T18:00', 'skipped'), task('no-date', '')])
    const nextWeek = workspace('health', '健康', [task('next', '2026-11-30T09:00')])
    expect(buildGoalAgenda([current], 0, now).items.map((item) => [item.task.id, item.task.status])).toEqual([['skipped', 'skipped']])
    expect(buildGoalAgenda([nextWeek], 1, now).items.map((item) => item.task.id)).toEqual(['next'])
  })

  it('builds one calendar export set with goal labels and unique ids across workspaces', () => {
    const items = buildAllGoalCalendarItems([
      workspace('career', '职业', [task('shared', '2026-11-25T18:00'), task('skip', '2026-11-25T19:00', 'skipped')]),
      workspace('health', '健康', [task('shared', '2026-11-25T18:30')]),
    ])
    expect(items.map((item) => item.title)).toEqual(['[职业] shared', '[健康] shared'])
    expect(new Set(items.map((item) => item.id)).size).toBe(2)
    expect(items[0].description).toContain('目标：职业')
    const ics = exportCalendarToIcs(items, { now: new Date('2026-11-20T00:00:00Z') })
    expect(ics).toContain('[职业] shared')
    expect(ics).toContain('[健康] shared')
  })

  it('collects only today actions from other goals and sorts by local time', () => {
    const today = workspace('health', '健康', [task('late', '2026-11-25T18:00'), task('early', '2026-11-25T08:00'), task('skip', '2026-11-25T09:00', 'skipped'), task('yesterday', '2026-11-24T18:00'), task('invalid', 'invalid')])
    const active = workspace('career', '职业', [task('active', '2026-11-25T07:00')])
    expect(buildTodayGoalActions([active, today], 'career', now).map((item) => [item.task.id, item.goalName])).toEqual([['early', '健康'], ['late', '健康']])
    expect(buildTodayGoalActions([active], 'career', now)).toEqual([])
  })
})
