import { localDateKey, type ActionTask, type GoalPlan, type OutcomeMetric } from './model'
import { metricProgress } from './metrics'

export type ProgressSliceActionKind = 'schedule-today' | 'schedule-week' | 'project' | 'metric' | 'goal' | 'review' | 'none'

export interface ProgressSliceItem {
  id: 'daily' | 'weekly' | 'monthly' | 'yearly'
  title: string
  periodLabel: string
  iconName: 'daily' | 'weekly' | 'monthly' | 'yearly'
  progress: number | null
  progressLabel: string
  statusBadge: string
  metricSummary: string
  hasData: boolean
  detail: string
  actionKind: ProgressSliceActionKind
  startDate?: string
  endDate?: string
  totalCount?: number
  confirmedCount?: number
}

export interface ProgressSlicesSummary {
  daily: ProgressSliceItem
  weekly: ProgressSliceItem
  monthly: ProgressSliceItem
  yearly: ProgressSliceItem
  items: ProgressSliceItem[]
}

/**
 * Builds the daily slice progress summary.
 * Counts ONLY evidence-confirmed tasks scheduled in today's local date window.
 * Displays a no-data state when there are no scheduled tasks, instead of inventing 0% or 100%.
 */
export function buildDailySlice(tasks: ActionTask[], now = new Date()): ProgressSliceItem {
  const todayKey = localDateKey(now)
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const month = todayDate.getMonth() + 1
  const day = todayDate.getDate()
  const periodLabel = `${month}月${day}日`

  const scheduledToday = tasks.filter((task) => {
    if (!task.scheduledAt || task.status === 'skipped') return false
    const scheduledDate = new Date(task.scheduledAt)
    if (!Number.isFinite(scheduledDate.getTime())) return false
    return localDateKey(scheduledDate) === todayKey
  })

  if (scheduledToday.length === 0) {
    const hasUnscheduledActive = tasks.some(
      (task) => !task.scheduledAt && (task.status === 'planned' || task.status === 'in-progress' || task.status === 'rescheduled'),
    )
    return {
      id: 'daily',
      title: '今日',
      periodLabel,
      iconName: 'daily',
      progress: null,
      progressLabel: '—',
      statusBadge: '今日无排期',
      metricSummary: '0 项排期',
      hasData: false,
      detail: hasUnscheduledActive ? '从待办选 1 项排入今天' : '排入 1 项今日行动',
      actionKind: 'schedule-today',
      startDate: todayKey,
      endDate: todayKey,
      totalCount: 0,
      confirmedCount: 0,
    }
  }

  const confirmedCount = scheduledToday.filter((task) => task.status === 'confirmed').length
  const pendingCount = scheduledToday.filter((task) => task.status === 'pending' || task.status === 'unobserved').length
  const openCount = scheduledToday.filter((task) => task.status === 'planned' || task.status === 'in-progress' || task.status === 'rescheduled').length
  const totalCount = scheduledToday.length
  const progress = Math.round((confirmedCount / totalCount) * 100)

  let detail: string
  let actionKind: ProgressSliceActionKind = 'project'
  if (confirmedCount === totalCount) {
    detail = '今日已全部确认，可做日终回顾'
    actionKind = 'review'
  } else if (openCount === 0 && pendingCount > 0) {
    detail = `核实 ${pendingCount} 项待确认证据`
  } else if (pendingCount > 0) {
    detail = `推进剩余项并核实 ${pendingCount} 项证据`
  } else {
    detail = `完成并确认剩余 ${openCount} 项今日排期`
  }

  return {
    id: 'daily',
    title: '今日',
    periodLabel,
    iconName: 'daily',
    progress,
    progressLabel: `${progress}%`,
    statusBadge: `${confirmedCount} / ${totalCount} 今日已确认`,
    metricSummary: `${confirmedCount} / ${totalCount} 已确认`,
    hasData: true,
    detail,
    actionKind,
    startDate: todayKey,
    endDate: todayKey,
    totalCount,
    confirmedCount,
  }
}

/**
 * Builds the weekly slice progress summary for the local Monday–Sunday window.
 * Counts ONLY evidence-confirmed tasks scheduled within the current local week.
 * Displays a no-data state when there are no scheduled tasks in the week.
 */
export function buildWeeklySlice(tasks: ActionTask[], now = new Date()): ProgressSliceItem {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const startDate = localDateKey(start)
  const endDate = localDateKey(end)
  const periodLabel = `${start.getMonth() + 1}/${start.getDate()}–${end.getMonth() + 1}/${end.getDate()}`

  const scheduledInWeek = tasks.filter((task) => {
    if (!task.scheduledAt || task.status === 'skipped') return false
    const scheduledDate = new Date(task.scheduledAt)
    if (!Number.isFinite(scheduledDate.getTime())) return false
    const dateKey = localDateKey(scheduledDate)
    return dateKey >= startDate && dateKey <= endDate
  })

  if (scheduledInWeek.length === 0) {
    return {
      id: 'weekly',
      title: '本周',
      periodLabel,
      iconName: 'weekly',
      progress: null,
      progressLabel: '—',
      statusBadge: '本周无排期',
      metricSummary: '0 项排期',
      hasData: false,
      detail: '安排本周专注块并确认产出',
      actionKind: 'schedule-week',
      startDate,
      endDate,
      totalCount: 0,
      confirmedCount: 0,
    }
  }

  const confirmedCount = scheduledInWeek.filter((task) => task.status === 'confirmed').length
  const pendingCount = scheduledInWeek.filter((task) => task.status === 'pending' || task.status === 'unobserved').length
  const openCount = scheduledInWeek.filter((task) => task.status === 'planned' || task.status === 'in-progress' || task.status === 'rescheduled').length
  const totalCount = scheduledInWeek.length
  const progress = Math.round((confirmedCount / totalCount) * 100)

  let detail: string
  let actionKind: ProgressSliceActionKind = 'project'
  if (confirmedCount === totalCount) {
    detail = '本周排期已全确认，可做周复盘'
    actionKind = 'review'
  } else if (openCount === 0 && pendingCount > 0) {
    detail = `核实本周 ${pendingCount} 项待确认证据`
  } else {
    detail = `本周还有 ${totalCount - confirmedCount} 项排期待确认`
  }

  return {
    id: 'weekly',
    title: '本周',
    periodLabel,
    iconName: 'weekly',
    progress,
    progressLabel: `${progress}%`,
    statusBadge: `${confirmedCount} / ${totalCount} 本周已确认`,
    metricSummary: `${confirmedCount} / ${totalCount} 已确认`,
    hasData: true,
    detail,
    actionKind,
    startDate,
    endDate,
    totalCount,
    confirmedCount,
  }
}

/**
 * Builds the monthly 30-day project progress slice using honest available evidence.
 * Displays progress of evidence-confirmed tasks for the current active project.
 * Distinguishes unconfirmed/pending tasks and does not invent completion without evidence.
 */
export function buildMonthlySlice(goal: GoalPlan, tasks: ActionTask[], now = new Date()): ProgressSliceItem {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  const startDate = localDateKey(start)
  const endDate = localDateKey(end)
  const periodLabel = '本月'

  const activeTasks = tasks.filter((task) => task.status !== 'skipped')

  if (activeTasks.length === 0) {
    const hasProject = Boolean(goal.project.trim())
    return {
      id: 'monthly',
      title: '30天项目',
      periodLabel,
      iconName: 'monthly',
      progress: null,
      progressLabel: '—',
      statusBadge: '暂无项目行动',
      metricSummary: '0 项行动',
      hasData: false,
      detail: hasProject ? '为项目添加第 1 项行动' : '先设定 30 天项目与第 1 项行动',
      actionKind: hasProject ? 'project' : 'goal',
      startDate,
      endDate,
      totalCount: 0,
      confirmedCount: 0,
    }
  }

  const confirmedCount = activeTasks.filter((task) => task.status === 'confirmed').length
  const pendingCount = activeTasks.filter((task) => task.status === 'pending' || task.status === 'unobserved').length
  const openCount = activeTasks.filter((task) => task.status === 'planned' || task.status === 'in-progress' || task.status === 'rescheduled').length
  const totalCount = activeTasks.length
  const progress = Math.round((confirmedCount / totalCount) * 100)

  let detail: string
  if (confirmedCount === totalCount) {
    detail = `全部 ${totalCount} 项行动已获确认证据`
  } else if (confirmedCount === 0 && openCount === 0 && pendingCount > 0) {
    detail = `补充 ${pendingCount} 项待核实行动证据`
  } else if (confirmedCount === 0) {
    detail = '推进并确认第 1 项项目产出'
  } else if (pendingCount > 0) {
    detail = `核实 ${pendingCount} 项证据并推进剩余项`
  } else {
    detail = `继续推进剩余 ${totalCount - confirmedCount} 项行动`
  }

  return {
    id: 'monthly',
    title: '30天项目',
    periodLabel,
    iconName: 'monthly',
    progress,
    progressLabel: `${progress}%`,
    statusBadge: `${confirmedCount} / ${totalCount} 项产出已确认`,
    metricSummary: `${confirmedCount} / ${totalCount} 已确认`,
    hasData: true,
    detail,
    actionKind: 'project',
    startDate,
    endDate,
    totalCount,
    confirmedCount,
  }
}

/**
 * Builds the yearly slice progress summary for annual milestones and outcome metrics.
 * Displays honest quantitative progress when valid outcome metrics exist.
 * Displays a no-data state when metrics are absent or unmeasurable, instead of inventing percentages.
 */
export function buildYearlySlice(goal: GoalPlan, now = new Date()): ProgressSliceItem {
  const year = now.getFullYear()
  const periodLabel = `${year}年`
  const metrics = goal.outcomeMetrics || []

  const validMetrics = metrics
    .map((metric) => ({ metric, progress: metricProgress(metric) }))
    .filter((item): item is { metric: OutcomeMetric; progress: number } => item.progress !== null)

  if (validMetrics.length === 0) {
    return {
      id: 'yearly',
      title: '年度里程碑',
      periodLabel,
      iconName: 'yearly',
      progress: null,
      progressLabel: '—',
      statusBadge: '待设量化指标',
      metricSummary: '未设指标',
      hasData: false,
      detail: metrics.length > 0
        ? '修改指标目标值，使其可量化'
        : '设定 1 项可量化结果指标',
      actionKind: 'metric',
      totalCount: metrics.length,
      confirmedCount: 0,
    }
  }

  const avgProgress = Math.round(
    validMetrics.reduce((sum, item) => sum + item.progress, 0) / validMetrics.length,
  )

  const statusBadge = validMetrics.length === 1
    ? `${validMetrics[0].metric.name} ${validMetrics[0].progress}%`
    : `${validMetrics.length} 项指标平均 ${avgProgress}%`

  const metricSummary = validMetrics.length === 1
    ? `${validMetrics[0].metric.name} ${validMetrics[0].metric.current}/${validMetrics[0].metric.target}`
    : `${validMetrics.length} 项量化指标`

  const detail = avgProgress >= 100
    ? '已达量化目标，可复盘或更新目标'
    : validMetrics.length === 1
      ? `按真实结果更新「${validMetrics[0].metric.name}」`
      : `按真实结果定期更新 ${validMetrics.length} 项指标`

  return {
    id: 'yearly',
    title: '年度里程碑',
    periodLabel,
    iconName: 'yearly',
    progress: avgProgress,
    progressLabel: `${avgProgress}%`,
    statusBadge,
    metricSummary,
    hasData: true,
    detail,
    actionKind: 'metric',
    totalCount: validMetrics.length,
    confirmedCount: validMetrics.filter((m) => m.progress >= 100).length,
  }
}

/**
 * Aggregates daily, weekly, monthly, and yearly progress summaries.
 */
export function buildProgressSlices(goal: GoalPlan, tasks: ActionTask[], now = new Date()): ProgressSlicesSummary {
  const daily = buildDailySlice(tasks, now)
  const weekly = buildWeeklySlice(tasks, now)
  const monthly = buildMonthlySlice(goal, tasks, now)
  const yearly = buildYearlySlice(goal, now)

  return {
    daily,
    weekly,
    monthly,
    yearly,
    items: [daily, weekly, monthly, yearly],
  }
}
