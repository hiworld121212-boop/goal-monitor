import { describe, expect, it } from 'vitest'
import type { ActionTask, GoalPlan, OutcomeMetric } from './model'
import {
  buildDailySlice,
  buildMonthlySlice,
  buildProgressSlices,
  buildWeeklySlice,
  buildYearlySlice,
} from './progressSlices'

const now = new Date(2026, 10, 23, 14, 0) // Monday, Nov 23, 2026

const makeTask = (overrides: Partial<ActionTask> = {}): ActionTask => ({
  id: 't-1',
  title: 'Test task',
  time: '18:00',
  duration: 30,
  doneWhen: 'Evidence is saved',
  evidence: 'Log output',
  status: 'planned',
  kind: 'build',
  ...overrides,
})

const makeGoal = (overrides: Partial<GoalPlan> = {}): GoalPlan => ({
  direction: 'Career advancement in AI and data engineering',
  annualMilestone: 'Achieve income promotion with verified offer',
  project: 'Build benchmark data pipeline showcase',
  projectOutcome: 'Deliver functioning showcase and get 3 reviews',
  weeklyCheckpoint: 'Complete first draft of pipeline',
  constraints: '3 focus blocks per week',
  timeBudget: '3 × 30 min / week',
  outcomeMetrics: [],
  ...overrides,
})

describe('Daily progress slice', () => {
  it('displays a no-data state when no actions are scheduled today', () => {
    const slice = buildDailySlice([
      makeTask({ scheduledAt: '2026-11-24T10:00' }), // Tomorrow
      makeTask({ scheduledAt: undefined }), // Unscheduled
    ], now)

    expect(slice.hasData).toBe(false)
    expect(slice.progress).toBeNull()
    expect(slice.progressLabel).toBe('—')
    expect(slice.statusBadge).toBe('今日无排期')
    expect(slice.detail).toContain('不预设完成比例')
  })

  it('counts only evidence-confirmed tasks in today local date window', () => {
    const slice = buildDailySlice([
      makeTask({ id: '1', scheduledAt: '2026-11-23T09:00', status: 'confirmed' }),
      makeTask({ id: '2', scheduledAt: '2026-11-23T14:30', status: 'in-progress' }),
      makeTask({ id: '3', scheduledAt: '2026-11-23T18:00', status: 'pending' }),
      makeTask({ id: '4', scheduledAt: '2026-11-23T20:00', status: 'planned' }),
      makeTask({ id: '5', scheduledAt: '2026-11-24T09:00', status: 'confirmed' }), // Tomorrow: excluded
    ], now)

    expect(slice.hasData).toBe(true)
    expect(slice.totalCount).toBe(4)
    expect(slice.confirmedCount).toBe(1)
    expect(slice.progress).toBe(25)
    expect(slice.progressLabel).toBe('25%')
    expect(slice.statusBadge).toBe('1 / 4 今日已确认')
    expect(slice.detail).toContain('还有 3 项待推进或待核实')
  })

  it('excludes skipped actions from scheduled daily total', () => {
    const slice = buildDailySlice([
      makeTask({ scheduledAt: '2026-11-23T09:00', status: 'confirmed' }),
      makeTask({ scheduledAt: '2026-11-23T14:00', status: 'skipped' }),
    ], now)

    expect(slice.totalCount).toBe(1)
    expect(slice.confirmedCount).toBe(1)
    expect(slice.progress).toBe(100)
    expect(slice.statusBadge).toBe('1 / 1 今日已确认')
  })
})

describe('Weekly progress slice', () => {
  it('displays a no-data state when no actions are scheduled in the current Monday–Sunday week', () => {
    const slice = buildWeeklySlice([
      makeTask({ scheduledAt: '2026-11-22T23:00' }), // Previous Sunday: outside window
      makeTask({ scheduledAt: '2026-11-30T09:00' }), // Next Monday: outside window
    ], now)

    expect(slice.hasData).toBe(false)
    expect(slice.progress).toBeNull()
    expect(slice.progressLabel).toBe('—')
    expect(slice.statusBadge).toBe('本周无排期')
  })

  it('correctly bounds the Monday to Sunday window and counts confirmed evidence', () => {
    // 2026-11-23 is Monday; week ends Sunday 2026-11-29
    const slice = buildWeeklySlice([
      makeTask({ scheduledAt: '2026-11-23T09:00', status: 'confirmed' }),
      makeTask({ scheduledAt: '2026-11-26T15:00', status: 'confirmed' }),
      makeTask({ scheduledAt: '2026-11-29T20:00', status: 'planned' }),
      makeTask({ scheduledAt: '2026-11-22T20:00', status: 'confirmed' }), // Last week: excluded
      makeTask({ scheduledAt: '2026-11-30T08:00', status: 'confirmed' }), // Next week: excluded
    ], now)

    expect(slice.hasData).toBe(true)
    expect(slice.totalCount).toBe(3)
    expect(slice.confirmedCount).toBe(2)
    expect(slice.progress).toBe(67)
    expect(slice.progressLabel).toBe('67%')
    expect(slice.statusBadge).toBe('2 / 3 本周已确认')
  })
})

describe('Monthly 30-day project progress slice', () => {
  it('displays a no-data state when the project has no actions', () => {
    const slice = buildMonthlySlice(makeGoal(), [], now)

    expect(slice.hasData).toBe(false)
    expect(slice.progress).toBeNull()
    expect(slice.progressLabel).toBe('—')
    expect(slice.statusBadge).toBe('暂无项目行动')
  })

  it('shows honest completion based on evidence-confirmed actions and distinguishes pending items', () => {
    const slice = buildMonthlySlice(makeGoal(), [
      makeTask({ id: '1', status: 'confirmed' }),
      makeTask({ id: '2', status: 'pending' }),
      makeTask({ id: '3', status: 'planned' }),
      makeTask({ id: '4', status: 'skipped' }), // Skipped is excluded
    ], now)

    expect(slice.hasData).toBe(true)
    expect(slice.totalCount).toBe(3)
    expect(slice.confirmedCount).toBe(1)
    expect(slice.progress).toBe(33)
    expect(slice.statusBadge).toBe('1 / 3 项产出已确认')
    expect(slice.detail).toContain('已确认 1 项产出，另有 1 项等待核实证据')
  })

  it('does not claim progress when all project tasks are still unconfirmed', () => {
    const slice = buildMonthlySlice(makeGoal(), [
      makeTask({ status: 'planned' }),
      makeTask({ status: 'in-progress' }),
    ], now)

    expect(slice.hasData).toBe(true)
    expect(slice.progress).toBe(0)
    expect(slice.statusBadge).toBe('0 / 2 项产出已确认')
    expect(slice.detail).toContain('尚未获得确认产出证据')
  })
})

describe('Yearly milestone and metric progress slice', () => {
  it('displays a no-data state without inventing percentages when no outcome metrics are set', () => {
    const slice = buildYearlySlice(makeGoal({
      annualMilestone: '通过晋升实现收入提升',
      outcomeMetrics: [],
    }), now)

    expect(slice.hasData).toBe(false)
    expect(slice.progress).toBeNull()
    expect(slice.progressLabel).toBe('—')
    expect(slice.statusBadge).toBe('待设定量化指标')
    expect(slice.detail).toContain('通过晋升实现收入提升（暂无量化数据，不预设比例）')
  })

  it('displays a no-data state when metric targets equal baselines (unmeasurable)', () => {
    const invalidMetric: OutcomeMetric = {
      id: 'm1',
      name: '储蓄',
      unit: 'AUD',
      direction: 'increase',
      baseline: 5000,
      target: 5000,
      current: 5000,
      updatedAt: '2026-11-20',
      history: [],
    }
    const slice = buildYearlySlice(makeGoal({ outcomeMetrics: [invalidMetric] }), now)

    expect(slice.hasData).toBe(false)
    expect(slice.progress).toBeNull()
    expect(slice.progressLabel).toBe('—')
  })

  it('calculates honest metric progress when measurable outcome metrics are provided', () => {
    const metric: OutcomeMetric = {
      id: 'salary',
      name: '年薪',
      unit: 'AUD / year',
      direction: 'increase',
      baseline: 80000,
      target: 150000,
      current: 100000,
      updatedAt: '2026-11-23',
      history: [],
    } // (100000 - 80000) / 70000 = 28.57% -> 29%
    const slice = buildYearlySlice(makeGoal({ outcomeMetrics: [metric] }), now)

    expect(slice.hasData).toBe(true)
    expect(slice.progress).toBe(29)
    expect(slice.progressLabel).toBe('29%')
    expect(slice.statusBadge).toBe('年薪 29%')
    expect(slice.detail).toContain('年薪：当前 100000 / 目标 150000 AUD / year')
  })

  it('averages multiple valid outcome metrics accurately', () => {
    const metric1: OutcomeMetric = {
      id: 'salary',
      name: '年薪',
      unit: 'AUD',
      direction: 'increase',
      baseline: 100,
      target: 200,
      current: 150, // 50%
      updatedAt: '2026-11-23',
      history: [],
    }
    const metric2: OutcomeMetric = {
      id: 'debt',
      name: '负债',
      unit: 'AUD',
      direction: 'decrease',
      baseline: 1000,
      target: 0,
      current: 200, // (200 - 1000) / (0 - 1000) = -800 / -1000 = 80%
      updatedAt: '2026-11-23',
      history: [],
    }
    const slice = buildYearlySlice(makeGoal({ outcomeMetrics: [metric1, metric2] }), now)

    expect(slice.hasData).toBe(true)
    expect(slice.progress).toBe(65) // (50 + 80) / 2 = 65%
    expect(slice.progressLabel).toBe('65%')
    expect(slice.statusBadge).toBe('2 项指标平均 65%')
  })
})

describe('Aggregate buildProgressSlices', () => {
  it('assembles all 4 slices with consistent items array', () => {
    const summary = buildProgressSlices(makeGoal(), demoTasks, now)

    expect(summary.items).toHaveLength(4)
    expect(summary.items.map((i) => i.id)).toEqual(['daily', 'weekly', 'monthly', 'yearly'])
    expect(summary.daily.id).toBe('daily')
    expect(summary.weekly.id).toBe('weekly')
    expect(summary.monthly.id).toBe('monthly')
    expect(summary.yearly.id).toBe('yearly')
  })
})

const demoTasks: ActionTask[] = [
  makeTask({ id: 'a1', title: 'Task 1', status: 'planned' }),
  makeTask({ id: 'a2', title: 'Task 2', status: 'planned' }),
  makeTask({ id: 'a3', title: 'Task 3', status: 'planned' }),
]
