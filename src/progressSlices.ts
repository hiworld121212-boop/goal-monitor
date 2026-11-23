import { localDateKey, type ActionTask, type GoalPlan, type OutcomeMetric } from './model'
import { metricProgress } from './metrics'

export interface ProgressSliceItem {
  id: 'daily' | 'weekly' | 'monthly' | 'yearly'
  title: string
  periodLabel: string
  iconName: 'daily' | 'weekly' | 'monthly' | 'yearly'
  progress: number | null
  progressLabel: string
  statusBadge: string
  hasData: boolean
  detail: string
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
  const periodLabel = `今日 · ${month}月${day}日`

  const scheduledToday = tasks.filter((task) => {
    if (!task.scheduledAt || task.status === 'skipped') return false
    const scheduledDate = new Date(task.scheduledAt)
    if (!Number.isFinite(scheduledDate.getTime())) return false
    return localDateKey(scheduledDate) === todayKey
  })

  if (scheduledToday.length === 0) {
    return {
      id: 'daily',
      title: '今日',
      periodLabel,
      iconName: 'daily',
      progress: null,
      progressLabel: '—',
      statusBadge: '今日无排期',
      hasData: false,
      detail: '今日暂无已排期行动；不预设完成比例。',
      startDate: todayKey,
      endDate: todayKey,
      totalCount: 0,
      confirmedCount: 0,
    }
  }

  const confirmedCount = scheduledToday.filter((task) => task.status === 'confirmed').length
  const totalCount = scheduledToday.length
  const progress = Math.round((confirmedCount / totalCount) * 100)

  return {
    id: 'daily',
    title: '今日',
    periodLabel,
    iconName: 'daily',
    progress,
    progressLabel: `${progress}%`,
    statusBadge: `${confirmedCount} / ${totalCount} 今日已确认`,
    hasData: true,
    detail: confirmedCount === totalCount
      ? '今日安排的行动全部已确认完成。'
      : `已确认 ${confirmedCount} 项产出，还有 ${totalCount - confirmedCount} 项待推进或待核实。`,
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
  const periodLabel = `本周 · ${start.getMonth() + 1}月${start.getDate()}日 ~ ${end.getMonth() + 1}月${end.getDate()}日`

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
      hasData: false,
      detail: '本周暂无已排期行动；排期代表投入，证据代表产出。',
      startDate,
      endDate,
      totalCount: 0,
      confirmedCount: 0,
    }
  }

  const confirmedCount = scheduledInWeek.filter((task) => task.status === 'confirmed').length
  const totalCount = scheduledInWeek.length
  const progress = Math.round((confirmedCount / totalCount) * 100)

  return {
    id: 'weekly',
    title: '本周',
    periodLabel,
    iconName: 'weekly',
    progress,
    progressLabel: `${progress}%`,
    statusBadge: `${confirmedCount} / ${totalCount} 本周已确认`,
    hasData: true,
    detail: `本周已安排 ${totalCount} 项专注块，已确认 ${confirmedCount} 项实际产出。`,
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
  const periodLabel = '30 天项目 · 本月'

  const activeTasks = tasks.filter((task) => task.status !== 'skipped')

  if (activeTasks.length === 0) {
    return {
      id: 'monthly',
      title: '30天项目',
      periodLabel,
      iconName: 'monthly',
      progress: null,
      progressLabel: '—',
      statusBadge: '暂无项目行动',
      hasData: false,
      detail: goal.project ? `当前项目「${goal.project}」尚未添加具体行动。` : '尚未设定当前 30 天项目。',
      startDate,
      endDate,
      totalCount: 0,
      confirmedCount: 0,
    }
  }

  const confirmedCount = activeTasks.filter((task) => task.status === 'confirmed').length
  const pendingCount = activeTasks.filter((task) => task.status === 'pending' || task.status === 'unobserved').length
  const totalCount = activeTasks.length
  const progress = Math.round((confirmedCount / totalCount) * 100)

  let detail: string
  if (confirmedCount === totalCount) {
    detail = `项目全部 ${totalCount} 项行动已获得明确产出证据。`
  } else if (confirmedCount > 0) {
    detail = pendingCount > 0
      ? `已确认 ${confirmedCount} 项产出，另有 ${pendingCount} 项等待核实证据。`
      : `已确认 ${confirmedCount} 项产出，还有 ${totalCount - confirmedCount} 项推进中。`
  } else {
    detail = pendingCount > 0
      ? `尚无已确认产出证据；${pendingCount} 项处于待核实状态，不自动判定失败。`
      : '尚未获得确认产出证据；时间流逝不代表项目自动完成。'
  }

  return {
    id: 'monthly',
    title: '30天项目',
    periodLabel,
    iconName: 'monthly',
    progress,
    progressLabel: `${progress}%`,
    statusBadge: `${confirmedCount} / ${totalCount} 项产出已确认`,
    hasData: true,
    detail,
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
  const periodLabel = `${year} 年度里程碑`
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
      statusBadge: '待设定量化指标',
      hasData: false,
      detail: goal.annualMilestone
        ? `${goal.annualMilestone}（暂无量化数据，不预设比例）`
        : '年度里程碑与量化指标待设定；未记录时不臆测完成度。',
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

  const detail = validMetrics
    .map((item) => `${item.metric.name}：当前 ${item.metric.current} / 目标 ${item.metric.target} ${item.metric.unit}`)
    .join('；')

  return {
    id: 'yearly',
    title: '年度里程碑',
    periodLabel,
    iconName: 'yearly',
    progress: avgProgress,
    progressLabel: `${avgProgress}%`,
    statusBadge,
    hasData: true,
    detail,
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
