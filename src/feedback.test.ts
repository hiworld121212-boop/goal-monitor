import { describe, expect, it } from 'vitest'
import { demoState, type ActionTask } from './model'
import { buildDailyProgressFeedback, buildReviewProgressContext } from './feedback'

const today = new Date(2026, 10, 23, 18, 0)
const task = (overrides: Partial<ActionTask> = {}): ActionTask => ({
  id: 't1', title: 'Build a demo', time: '', duration: 30, doneWhen: 'A test passes', evidence: 'Test output',
  status: 'planned', kind: 'build', ...overrides,
})

describe('daily goal progress feedback', () => {
  it('shows the confirmed count and recommends the next scheduled action', () => {
    const result = buildDailyProgressFeedback([
      task({ id: 'done', status: 'confirmed', scheduledAt: '2026-11-23T17:00' }),
      task({ id: 'next', title: 'Write the result', scheduledAt: '2026-11-23T18:30' }),
      task({ id: 'tomorrow', scheduledAt: '2026-11-24T10:00' }),
    ], today)
    expect(result.headline).toContain('1/2')
    expect(result.confirmedCount).toBe(1)
    expect(result.nextTask?.id).toBe('next')
    expect(result.detail).toContain('不代表失败')
  })

  it('distinguishes waiting evidence from an action that is still planned', () => {
    const result = buildDailyProgressFeedback([
      task({ status: 'pending', scheduledAt: '2026-11-23T17:00' }),
    ], today)
    expect(result.headline).toContain('待核实')
    expect(result.waitingCount).toBe(1)
    expect(result.nextTask).toBeUndefined()
    expect(result.detail).toContain('不会把它们自动判成失败')
  })

  it('suggests a next action when none has a calendar time today', () => {
    const result = buildDailyProgressFeedback(demoState.tasks, today)
    expect(result.headline).toBe('今天还没有安排专注块')
    expect(result.nextTask?.id).toBe('a1')
  })

  it('reports an already-started action as in progress instead of restarting it', () => {
    const result = buildDailyProgressFeedback([task({ status: 'in-progress' })], today)
    expect(result.headline).toBe('今天还没有安排专注块')
    expect(result.detail).toContain('你已经开始这项行动')
    expect(result.nextTask?.status).toBe('in-progress')
  })

  it('handles an empty task list without inventing progress', () => {
    const result = buildDailyProgressFeedback([], today)
    expect(result.headline).toBe('当前没有待推进的行动')
    expect(result.scheduledCount).toBe(0)
    expect(result.nextTask).toBeUndefined()
  })

  it('does not report an empty evidence queue when all actions are confirmed', () => {
    const result = buildDailyProgressFeedback([task({ status: 'confirmed' })], today)
    expect(result.headline).toBe('当前没有待推进的行动')
    expect(result.waitingCount).toBe(0)
  })

  it('reports all scheduled actions confirmed when no further work remains', () => {
    const result = buildDailyProgressFeedback([
      task({ status: 'confirmed', scheduledAt: '2026-11-23T17:00' }),
    ], today)
    expect(result.headline).toBe('今天安排的行动都已确认')
    expect(result.confirmedCount).toBe(1)
  })
})

describe('review period evidence context', () => {
  it('uses the local Monday-to-Sunday window for weekly review and counts current states', () => {
    const result = buildReviewProgressContext([
      task({ id: 'confirmed', status: 'confirmed', scheduledAt: '2026-11-23T09:00' }),
      task({ id: 'waiting', status: 'pending', scheduledAt: '2026-11-28T09:00' }),
      task({ id: 'outside', scheduledAt: '2026-11-22T09:00' }),
      task({ id: 'unscheduled', status: 'in-progress' }),
    ], 'week', new Date(2026, 10, 29, 12))
    expect(result.startDate).toBe('2026-11-23')
    expect(result.endDate).toBe('2026-11-29')
    expect(result.scheduledCount).toBe(2)
    expect(result.confirmedCount).toBe(1)
    expect(result.waitingCount).toBe(1)
    expect(result.unscheduledCount).toBe(1)
    expect(result.observation).toContain('已确认 1')
    expect(result.prompt).toContain('推动了项目')
  })

  it('uses a rolling 14-day window and a calendar-month window', () => {
    const fortnight = buildReviewProgressContext([], 'fortnight', new Date(2026, 10, 23, 8))
    const month = buildReviewProgressContext([], 'month', new Date(2026, 10, 23, 8))
    expect(fortnight.startDate).toBe('2026-11-10')
    expect(month.startDate).toBe('2026-11-01')
    expect(fortnight.endDate).toBe('2026-11-23')
  })

  it('keeps missing schedule data separate from negative outcomes', () => {
    const result = buildReviewProgressContext([task()], 'day', today)
    expect(result.scheduledCount).toBe(0)
    expect(result.unscheduledCount).toBe(1)
    expect(result.observation).toContain('没有已排期')
    expect(result.prompt).toContain('不代表没有做事')
  })
})
