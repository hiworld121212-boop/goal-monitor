export type TaskStatus = 'planned' | 'in-progress' | 'confirmed' | 'pending' | 'unobserved' | 'rescheduled' | 'skipped'
export type EvidenceStatus = 'confirmed' | 'pending' | 'unobserved' | 'source-unavailable'

export interface GoalPlan {
  direction: string
  annualMilestone: string
  project: string
  projectOutcome: string
  weeklyCheckpoint: string
  constraints: string
  timeBudget: string
  outcomeMetrics: OutcomeMetric[]
}

export interface OutcomeMetric {
  id: string
  name: string
  unit: string
  direction: 'increase' | 'decrease'
  baseline: number
  target: number
  current: number
  updatedAt: string
  evidenceNote?: string
  history: MetricSnapshot[]
}

export interface MetricSnapshot {
  recordedAt: string
  value: number
  evidenceNote?: string
}

export interface ActionTask {
  id: string
  title: string
  time: string
  duration: number
  doneWhen: string
  evidence: string
  evidenceNote?: string
  status: TaskStatus
  kind: 'build' | 'research' | 'share'
  scheduledAt?: string
}

export interface ReminderPreferences {
  enabled: boolean
  focusLeadMinutes: number
  dailyReviewTime: string
  weeklyReviewDay: number
  weeklyReviewTime: string
  notificationPermissionRequested: boolean
}

export interface DayReview {
  date: string
  result: string
  obstacle: string
  nextStep: string
}

export interface WeekReview {
  date: string
  decision: string
  note: string
}

export interface MonitorState {
  goal: GoalPlan
  tasks: ActionTask[]
  dayReviews: DayReview[]
  weekReviews: WeekReview[]
  dismissedSuggestion: boolean
  reminders: ReminderPreferences
  goalSpaces: GoalWorkspace[]
  activeGoalSpaceId: string
  weeklyFocusBudgetMinutes: number
}

export interface GoalWorkspace {
  id: string
  name: string
  goal: GoalPlan
  tasks: ActionTask[]
  dayReviews: DayReview[]
  weekReviews: WeekReview[]
}

export const defaultReminderPreferences: ReminderPreferences = {
  enabled: false,
  focusLeadMinutes: 10,
  dailyReviewTime: '20:30',
  weeklyReviewDay: 0,
  weeklyReviewTime: '10:00',
  notificationPermissionRequested: false,
}

export const demoState: MonitorState = {
  goal: {
    direction: '提高数据工程与 AI 系统方面的职业收入与工作选择空间。',
    annualMilestone: '通过晋升或新岗位，实现可衡量的收入提升。目标金额待设定。',
    project: '做一个展示目标岗位核心技能的案例，并获得真实反馈。',
    projectOutcome: '完成一个可运行、可讲解的案例；向 3 位同行或招聘相关对象征求反馈。',
    weeklyCheckpoint: '找出 5 个目标岗位的共同要求，选定案例题目并完成第一版。',
    constraints: '围绕全职数据工程工作安排；每周先保护 3 个专注块。',
    timeBudget: '3 × 30 分钟 / 周',
    outcomeMetrics: [],
  },
  tasks: [
    { id: 'a1', title: '比较两份目标岗位描述，标出重复技能', time: '今天 · 18:30', duration: 30, doneWhen: '保存两份岗位链接，并写下一项重复出现的技能。', evidence: '岗位链接 + 技能笔记', status: 'planned', kind: 'research' },
    { id: 'a2', title: '为案例建立数据质量检查的最小流程', time: '本周下一专注块', duration: 45, doneWhen: '本地跑通一条检查，并保存结果。', evidence: '代码提交或运行截图', status: 'planned', kind: 'build' },
    { id: 'a3', title: '把案例说明发给一位同行征求反馈', time: '本周第三个专注块', duration: 30, doneWhen: '发出一条具体反馈请求。', evidence: '反馈请求记录', status: 'planned', kind: 'share' },
  ],
  dayReviews: [],
  weekReviews: [],
  dismissedSuggestion: false,
  reminders: defaultReminderPreferences,
  goalSpaces: [],
  activeGoalSpaceId: 'career-finance',
  weeklyFocusBudgetMinutes: 0,
}

demoState.goalSpaces = [{ id: 'career-finance', name: '职业与财务', goal: demoState.goal, tasks: demoState.tasks, dayReviews: demoState.dayReviews, weekReviews: demoState.weekReviews }]

export const storageKey = 'northstar-goal-monitor-v1'

export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function loadState(): MonitorState {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return demoState
    const stored = JSON.parse(raw) as Partial<MonitorState>
    const migratedGoal: GoalPlan = {
      ...demoState.goal,
      ...stored.goal,
      outcomeMetrics: (stored.goal?.outcomeMetrics ?? demoState.goal.outcomeMetrics).map((metric) => ({ ...metric, history: metric.history ?? [] })),
    }
    const goalSpaces = (stored.goalSpaces?.length ? stored.goalSpaces : [{
      id: 'career-finance', name: '职业与财务', goal: migratedGoal, tasks: stored.tasks ?? demoState.tasks,
      dayReviews: stored.dayReviews ?? [], weekReviews: stored.weekReviews ?? [],
    }]).map((workspace) => ({
      ...workspace,
      goal: { ...demoState.goal, ...workspace.goal, outcomeMetrics: (workspace.goal?.outcomeMetrics ?? []).map((metric) => ({ ...metric, history: metric.history ?? [] })) },
      tasks: workspace.tasks ?? [],
      dayReviews: workspace.dayReviews ?? [],
      weekReviews: workspace.weekReviews ?? [],
    }))
    const activeWorkspace = goalSpaces.find((workspace) => workspace.id === stored.activeGoalSpaceId) ?? goalSpaces[0]
    return {
      ...demoState,
      ...stored,
      weeklyFocusBudgetMinutes: typeof stored.weeklyFocusBudgetMinutes === 'number' && Number.isFinite(stored.weeklyFocusBudgetMinutes) && stored.weeklyFocusBudgetMinutes > 0 ? Math.min(3000, Math.round(stored.weeklyFocusBudgetMinutes)) : 0,
      goalSpaces,
      activeGoalSpaceId: activeWorkspace.id,
      goal: activeWorkspace.goal,
      tasks: activeWorkspace.tasks,
      dayReviews: activeWorkspace.dayReviews,
      weekReviews: activeWorkspace.weekReviews,
      reminders: { ...defaultReminderPreferences, ...stored.reminders },
    }
  } catch {
    return demoState
  }
}

export function syncActiveGoalWorkspace(state: MonitorState): MonitorState {
  const activeWorkspace: GoalWorkspace = {
    id: state.activeGoalSpaceId,
    name: state.goalSpaces.find((workspace) => workspace.id === state.activeGoalSpaceId)?.name ?? '目标',
    goal: state.goal,
    tasks: state.tasks,
    dayReviews: state.dayReviews,
    weekReviews: state.weekReviews,
  }
  const exists = state.goalSpaces.some((workspace) => workspace.id === state.activeGoalSpaceId)
  return { ...state, goalSpaces: exists ? state.goalSpaces.map((workspace) => workspace.id === activeWorkspace.id ? activeWorkspace : workspace) : [...state.goalSpaces, activeWorkspace] }
}

export function saveState(state: MonitorState) {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

export function changeTaskStatus(tasks: ActionTask[], taskId: string, status: TaskStatus): ActionTask[] {
  return tasks.map((task) => task.id === taskId ? { ...task, status } : task)
}

export function completedCount(tasks: ActionTask[]) {
  return tasks.filter((task) => task.status === 'confirmed').length
}
