import { localDateKey, type ActionTask } from './model'

export interface DailyProgressFeedback {
  headline: string
  detail: string
  scheduledCount: number
  confirmedCount: number
  waitingCount: number
  nextTask?: ActionTask
}

export type ReviewWindow = 'day' | 'week' | 'fortnight' | 'month'

export interface ReviewProgressContext {
  startDate: string
  endDate: string
  scheduledCount: number
  confirmedCount: number
  waitingCount: number
  inProgressCount: number
  plannedCount: number
  unscheduledCount: number
  observation: string
  prompt: string
}

export function getReviewDateRange(window: ReviewWindow, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  if (window === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  } else if (window === 'day') {
    // Today only.
  } else if (window === 'month') {
    start.setDate(1)
  } else {
    start.setDate(start.getDate() - 13)
  }
  return { startDate: localDateKey(start), endDate: localDateKey(end) }
}

/** Builds transparent, evidence-bound daily guidance without inferring failure or using AI. */
export function buildDailyProgressFeedback(tasks: ActionTask[], now = new Date()): DailyProgressFeedback {
  const today = localDateKey(now)
  const visible = tasks.filter((task) => task.status !== 'skipped')
  const active = visible.filter((task) => task.status === 'planned' || task.status === 'in-progress' || task.status === 'rescheduled')
  const waiting = visible.filter((task) => task.status === 'pending' || task.status === 'unobserved')
  const scheduledToday = visible
    .filter((task) => task.scheduledAt && localDateKey(new Date(task.scheduledAt)) === today)
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))
  const confirmedCount = scheduledToday.filter((task) => task.status === 'confirmed').length
  const waitingCount = scheduledToday.filter((task) => task.status === 'pending' || task.status === 'unobserved').length
  const nextTask = scheduledToday.find((task) => task.status === 'in-progress')
    || scheduledToday.find((task) => task.status === 'planned' || task.status === 'rescheduled')
    || active.find((task) => !task.scheduledAt && task.status === 'in-progress')
    || active.find((task) => !task.scheduledAt)

  if (scheduledToday.length > 0) {
    const openCount = scheduledToday.filter((task) => task.status === 'planned' || task.status === 'in-progress' || task.status === 'rescheduled').length
    if (openCount === 0 && waitingCount > 0) {
      return {
        headline: '今天的行动已更新，还有记录待核实',
        detail: `${waitingCount} 项处于待确认或未观察状态。检查证据即可；系统不会把它们自动判成失败。`,
        scheduledCount: scheduledToday.length,
        confirmedCount,
        waitingCount,
      }
    }
    if (openCount === 0) {
      return {
        headline: confirmedCount === scheduledToday.length ? '今天安排的行动都已确认' : '今天没有待推进的排期行动',
        detail: '记录的是已确认的成果和计划状态；如果还有精力，可以在复盘中决定是否继续。',
        scheduledCount: scheduledToday.length,
        confirmedCount,
        waitingCount,
      }
    }
    return {
      headline: confirmedCount > 0 ? `今天已确认 ${confirmedCount}/${scheduledToday.length} 项行动` : `今天安排了 ${scheduledToday.length} 项专注行动`,
      detail: `还有 ${openCount} 项没有确认完成。状态空白只代表尚未记录，不代表失败。`,
      scheduledCount: scheduledToday.length,
      confirmedCount,
      waitingCount,
      nextTask,
    }
  }

  if (nextTask) {
    return {
      headline: '今天还没有安排专注块',
      detail: nextTask.status === 'in-progress'
        ? `你已经开始这项行动。完成标准：${nextTask.doneWhen}`
        : `项目里还有 ${active.length} 项可推进行动。先选一项安排时间，或从最小的一步开始。`,
      scheduledCount: 0,
      confirmedCount: 0,
      waitingCount: waiting.length,
      nextTask,
    }
  }
  if (active.length === 0 && waiting.length === 0) {
    return {
      headline: '当前没有待推进的行动',
      detail: '添加一项与 30 天项目成果直接相关、并且有明确完成标准的行动。',
      scheduledCount: 0,
      confirmedCount: 0,
      waitingCount: 0,
    }
  }
  const remainingWaitingCount = waiting.length
  return {
    headline: '下一步是核对待确认记录',
    detail: `${remainingWaitingCount} 项行动等待证据或你的确认；缺少自动数据时，可以手动补充简短说明。`,
    scheduledCount: 0,
    confirmedCount: 0,
    waitingCount: remainingWaitingCount,
  }
}

/** Summarizes current states of tasks scheduled in a review window; it does not infer when work happened. */
export function buildReviewProgressContext(
  tasks: ActionTask[],
  window: ReviewWindow,
  now = new Date(),
): ReviewProgressContext {
  const { startDate, endDate } = getReviewDateRange(window, now)
  const inRange = tasks.filter((task) => {
    if (!task.scheduledAt || task.status === 'skipped') return false
    const scheduledDate = new Date(task.scheduledAt)
    if (!Number.isFinite(scheduledDate.getTime())) return false
    const key = localDateKey(scheduledDate)
    return key >= startDate && key <= endDate
  })
  const confirmedCount = inRange.filter((task) => task.status === 'confirmed').length
  const waitingCount = inRange.filter((task) => task.status === 'pending' || task.status === 'unobserved').length
  const inProgressCount = inRange.filter((task) => task.status === 'in-progress').length
  const plannedCount = inRange.filter((task) => task.status === 'planned' || task.status === 'rescheduled').length
  const unscheduledCount = tasks.filter((task) => !task.scheduledAt && (task.status === 'planned' || task.status === 'in-progress' || task.status === 'rescheduled' || task.status === 'pending' || task.status === 'unobserved')).length

  let observation: string
  let prompt: string
  if (inRange.length === 0) {
    observation = `这段时间没有已排期且未跳过的行动记录。另有 ${unscheduledCount} 项行动没有排期。`
    prompt = '你可以手动写下实际产出和阻碍；缺少排期数据不代表没有做事。'
  } else {
    observation = `区间内排期 ${inRange.length} 项：已确认 ${confirmedCount}，待核实 ${waitingCount}，进行中 ${inProgressCount}，计划中 ${plannedCount}。未排期行动 ${unscheduledCount} 项。`
    if (confirmedCount > 0) {
      prompt = '哪些已确认行动确实推动了项目？保留有效杠杆，并选定下一步可获得的反馈。'
    } else if (waitingCount > 0) {
      prompt = '先区分还没完成的行动和只缺证据的行动。待核实状态不会被自动当成失败。'
    } else {
      prompt = '当前没有已确认的排期成果。检查行动范围、时间安排或证据记录；这不自动说明没有进展。'
    }
  }

  return { startDate, endDate, scheduledCount: inRange.length, confirmedCount, waitingCount, inProgressCount, plannedCount, unscheduledCount, observation, prompt }
}
