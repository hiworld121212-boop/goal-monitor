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
  it('displays an honest no-data state and suggests scheduling an unscheduled action', () => {
    const slice = buildDailySlice([
      makeTask({ scheduledAt: '2026-11-24T10:00' }), // Tomorrow
      makeTask({ scheduledAt: undefined, status: 'planned' }), // Unscheduled active
    ], now)

    expect(slice.hasData).toBe(false)
    expect(slice.progress).toBeNull()
    expect(slice.progressLabel).toBe('—')
    expect(slice.statusBadge).toBe('今日无排期')
    expect(slice.detail).toBe('从待办选 1 项排入今天')
    expect(slice.actionKind).toBe('schedule-today')
  })

  it('displays concise schedule guidance when there are no tasks at all', () => {
    const slice = buildDailySlice([], now)

    expect(slice.hasData).toBe(false)
    expect(slice.statusBadge).toBe('今日无排期')
    expect(slice.detail).toBe('排入 1 项今日行动')
    expect(slice.actionKind).toBe('schedule-today')
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
    expect(slice.metricSummary).toBe('1 / 4 已确认')
    expect(slice.detail).toBe('推进剩余项并核实 1 项证据')
  })

  it('guides user to verify pending evidence when no open tasks remain today', () => {
    const slice = buildDailySlice([
      makeTask({ id: '1', scheduledAt: '2026-11-23T09:00', status: 'pending' }),
      makeTask({ id: '2', scheduledAt: '2026-11-23T14:30', status: 'unobserved' }),
    ], now)

    expect(slice.progress).toBe(0)
    expect(slice.metricSummary).toBe('0 / 2 已确认')
    expect(slice.detail).toBe('核实 2 项待确认证据')
  })

  it('excludes skipped actions and prompts daily review when all scheduled tasks are confirmed', () => {
    const slice = buildDailySlice([
      makeTask({ scheduledAt: '2026-11-23T09:00', status: 'confirmed' }),
      makeTask({ scheduledAt: '2026-11-23T14:00', status: 'skipped' }),
    ], now)

    expect(slice.totalCount).toBe(1)
    expect(slice.confirmedCount).toBe(1)
    expect(slice.progress).toBe(100)
    expect(slice.metricSummary).toBe('1 / 1 已确认')
    expect(slice.detail).toBe('今日已全部确认，可做日终回顾')
    expect(slice.actionKind).toBe('review')
  })
})

describe('Weekly progress slice', () => {
  it('displays a no-data state and weekly scheduling guidance when no actions are scheduled Monday–Sunday', () => {
    const slice = buildWeeklySlice([
      makeTask({ scheduledAt: '2026-11-22T23:00' }), // Previous Sunday: outside window
      makeTask({ scheduledAt: '2026-11-30T09:00' }), // Next Monday: outside window
    ], now)

    expect(slice.hasData).toBe(false)
    expect(slice.progress).toBeNull()
    expect(slice.progressLabel).toBe('—')
    expect(slice.statusBadge).toBe('本周无排期')
    expect(slice.detail).toBe('安排本周专注块并确认产出')
    expect(slice.actionKind).toBe('schedule-week')
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
    expect(slice.metricSummary).toBe('2 / 3 已确认')
    expect(slice.detail).toBe('本周还有 1 项排期待确认')
  })

  it('prompts weekly review when all scheduled tasks in the week are confirmed', () => {
    const slice = buildWeeklySlice([
      makeTask({ scheduledAt: '2026-11-23T09:00', status: 'confirmed' }),
    ], now)

    expect(slice.progress).toBe(100)
    expect(slice.detail).toBe('本周排期已全确认，可做周复盘')
    expect(slice.actionKind).toBe('review')
  })
})

describe('Monthly 30-day project progress slice', () => {
  it('displays a no-data state with clear next-step guidance when the project has no actions', () => {
    const slice = buildMonthlySlice(makeGoal(), [], now)

    expect(slice.hasData).toBe(false)
    expect(slice.progress).toBeNull()
    expect(slice.progressLabel).toBe('—')
    expect(slice.statusBadge).toBe('暂无项目行动')
    expect(slice.detail).toBe('为项目添加第 1 项行动')
    expect(slice.actionKind).toBe('project')
  })

  it('guides setting project and first action when goal.project is empty', () => {
    const slice = buildMonthlySlice(makeGoal({ project: '   ' }), [], now)

    expect(slice.hasData).toBe(false)
    expect(slice.detail).toBe('先设定 30 天项目与第 1 项行动')
    expect(slice.actionKind).toBe('goal')
  })

  it('shows honest completion based on evidence-confirmed actions and guides pending verification', () => {
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
    expect(slice.metricSummary).toBe('1 / 3 已确认')
    expect(slice.detail).toBe('核实 1 项证据并推进剩余项')
  })

  it('does not claim progress when all project tasks are still unconfirmed', () => {
    const slice = buildMonthlySlice(makeGoal(), [
      makeTask({ status: 'planned' }),
      makeTask({ status: 'in-progress' }),
    ], now)

    expect(slice.hasData).toBe(true)
    expect(slice.progress).toBe(0)
    expect(slice.metricSummary).toBe('0 / 2 已确认')
    expect(slice.detail).toBe('推进并确认第 1 项项目产出')
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
    expect(slice.statusBadge).toBe('待设量化指标')
    expect(slice.detail).toBe('设定 1 项可量化结果指标')
    expect(slice.actionKind).toBe('metric')
  })

  it('displays a no-data state and fix guidance when metric targets equal baselines (unmeasurable)', () => {
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
    expect(slice.detail).toBe('修改指标目标值，使其可量化')
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
    expect(slice.metricSummary).toBe('年薪 100000/150000')
    expect(slice.detail).toBe('按真实结果更新「年薪」')
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
    expect(slice.metricSummary).toBe('2 项量化指标')
    expect(slice.detail).toBe('按真实结果定期更新 2 项指标')
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
