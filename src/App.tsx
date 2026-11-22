import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2, Download,
  ChevronDown, Circle, Clock3, Compass, ExternalLink, FileCheck2, Flag, FolderKanban,
  LayoutDashboard, Menu, MoreHorizontal, Plus, RefreshCw, Sparkles, Target, X,
} from 'lucide-react'
import {
  changeTaskStatus, completedCount, demoState, loadState, localDateKey, saveState,
  syncActiveGoalWorkspace, type ActionTask, type GoalPlan, type GoalWorkspace, type MonitorState, type OutcomeMetric,
} from './model'
import { exportCalendarToIcs } from './calendarExport'
import { getDueReminders, type DueReminder, type ReminderTask } from './reminders'
import { buildDailyProgressFeedback, buildReviewProgressContext } from './feedback'
import { buildMetricReviewContext, isValidMetric, metricProgress, metricTrendCoordinates } from './metrics'
import { buildAllGoalCalendarItems, buildGoalAgenda, buildTodayGoalActions } from './goalCalendar'
import { buildWeeklyCapacitySummary } from './weeklyCapacity'

type Page = 'today' | 'calendar' | 'direction' | 'project' | 'reviews'
type ReviewMode = 'day' | 'week' | 'fortnight' | 'month'

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'today', label: '今日行动', icon: LayoutDashboard },
  { id: 'calendar', label: '日历', icon: CalendarDays },
  { id: 'direction', label: '目标地图', icon: Compass },
  { id: 'project', label: '当前项目', icon: FolderKanban },
  { id: 'reviews', label: '复盘记录', icon: RefreshCw },
]

function App() {
  const [state, setState] = useState<MonitorState>(() => loadState())
  const [page, setPage] = useState<Page>('today')
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null)
  const [showGoalEditor, setShowGoalEditor] = useState(false)
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [showTaskEditor, setShowTaskEditor] = useState(false)
  const [editingTask, setEditingTask] = useState<ActionTask | undefined>()
  const [editingMetric, setEditingMetric] = useState<OutcomeMetric | undefined>()
  const [showIntegrations, setShowIntegrations] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [reminderNotice, setReminderNotice] = useState<DueReminder | null>(null)
  const firedReminders = useRef<Set<string>>(new Set())

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    try {
      const fired = JSON.parse(localStorage.getItem('northstar-reminders-fired-v1') || '[]') as string[]
      firedReminders.current = new Set(fired)
    } catch {
      firedReminders.current = new Set()
    }
  }, [])
  useEffect(() => {
    const check = () => {
      const allTasks: ReminderTask[] = state.goalSpaces.flatMap((workspace) => workspace.tasks.map((task) => ({ ...task, goalSpaceId: workspace.id, goalName: workspace.name })))
      const due = getDueReminders(new Date(), allTasks, state.reminders).find((item) => !firedReminders.current.has(item.key))
      if (!due) return
      firedReminders.current.add(due.key)
      localStorage.setItem('northstar-reminders-fired-v1', JSON.stringify([...firedReminders.current].slice(-100)))
      setReminderNotice(due)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(due.title, { body: due.body })
      }
      window.setTimeout(() => setReminderNotice((current) => current?.key === due.key ? null : current), 12_000)
    }
    check()
    const timer = window.setInterval(check, 30_000)
    return () => window.clearInterval(timer)
  }, [state.goalSpaces, state.reminders])
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNav(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const todayLabel = useMemo(() => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()), [])
  const done = completedCount(state.tasks)
  const progress = Math.round((done / Math.max(1, state.tasks.length)) * 100)

  function updateMonitorState(updater: (current: MonitorState) => MonitorState) {
    setState((current) => syncActiveGoalWorkspace(updater(current)))
  }

  function switchGoalSpace(goalSpaceId: string) {
    const workspace = state.goalSpaces.find((item) => item.id === goalSpaceId)
    if (!workspace) return
    setState((current) => ({ ...current, activeGoalSpaceId: workspace.id, goal: workspace.goal, tasks: workspace.tasks, dayReviews: workspace.dayReviews, weekReviews: workspace.weekReviews }))
    setPage('today')
  }

  function createGoalSpace(name: string, direction: string) {
    const id = crypto.randomUUID()
    const goal: GoalPlan = { direction, annualMilestone: '', project: '', projectOutcome: '', weeklyCheckpoint: '', constraints: '', timeBudget: '', outcomeMetrics: [] }
    const workspace: GoalWorkspace = { id, name, goal, tasks: [], dayReviews: [], weekReviews: [] }
    updateMonitorState((current) => ({ ...current, activeGoalSpaceId: id, goal, tasks: [], dayReviews: [], weekReviews: [], goalSpaces: [...current.goalSpaces, workspace] }))
    setShowNewGoal(false)
    setPage('today')
  }

  function updateGoal(goal: GoalPlan) {
    updateMonitorState((current) => ({ ...current, goal }))
  }
  function updateMetric(metricId: string, currentValue: number, evidenceNote: string) {
    updateMonitorState((current) => ({
      ...current,
      goal: { ...current.goal, outcomeMetrics: current.goal.outcomeMetrics.map((metric) => metric.id === metricId ? { ...metric, current: currentValue, updatedAt: localDateKey(), evidenceNote: evidenceNote.trim() || undefined, history: [...(metric.history || []), { recordedAt: new Date().toISOString(), value: currentValue, evidenceNote: evidenceNote.trim() || undefined }] } : metric) },
    }))
  }
  function updateTask(taskId: string, status: ActionTask['status']) {
    updateMonitorState((current) => ({ ...current, tasks: changeTaskStatus(current.tasks, taskId, status) }))
  }
  function startTask(taskId: string) {
    updateTask(taskId, 'in-progress')
    setPage('project')
  }
  function confirmTask(goalSpaceId: string, taskId: string) {
    const evidenceNote = window.prompt('记录本次完成证据（可选）', '')?.trim()
    if (evidenceNote === null || evidenceNote === undefined) return
    setState((current) => {
      const updateTasks = (tasks: ActionTask[]) => tasks.map((task) => task.id === taskId ? { ...task, status: 'confirmed' as const, evidenceNote: evidenceNote || undefined } : task)
      const goalSpaces = current.goalSpaces.map((space) => space.id === goalSpaceId ? { ...space, tasks: updateTasks(space.tasks) } : space)
      const active = goalSpaces.find((space) => space.id === current.activeGoalSpaceId)
      return active ? { ...current, goalSpaces, tasks: active.tasks, goal: active.goal, dayReviews: active.dayReviews, weekReviews: active.weekReviews } : { ...current, goalSpaces }
    })
  }
  function updateGoalTask(goalSpaceId: string, taskId: string, status: ActionTask['status']) {
    setState((current) => {
      const goalSpaces = current.goalSpaces.map((space) => space.id === goalSpaceId ? { ...space, tasks: changeTaskStatus(space.tasks, taskId, status) } : space)
      const active = goalSpaces.find((space) => space.id === current.activeGoalSpaceId)
      return active ? { ...current, goalSpaces, tasks: active.tasks, goal: active.goal, dayReviews: active.dayReviews, weekReviews: active.weekReviews } : { ...current, goalSpaces }
    })
  }
  function addTask(title: string, doneWhen: string, scheduledAt: string, duration: number, taskId?: string) {
    updateMonitorState((current) => ({
      ...current,
      tasks: taskId
        ? current.tasks.map((task) => task.id === taskId ? { ...task, title, doneWhen, scheduledAt: scheduledAt || undefined, time: scheduledAt ? new Date(scheduledAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '待安排', duration } : task)
        : [...current.tasks, { id: crypto.randomUUID(), title, time: scheduledAt ? new Date(scheduledAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '待安排', duration, doneWhen, evidence: '用户确认或添加证据链接', status: 'planned', kind: 'build', scheduledAt: scheduledAt || undefined }],
    }))
  }
  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      updateMonitorState((current) => ({ ...current, reminders: { ...current.reminders, enabled: true, notificationPermissionRequested: true } }))
      setReminderNotice({ key: `permission:${Date.now()}`, title: '应用内提醒已启用', body: '此浏览器不支持系统通知；应用页面运行时会显示提醒。' })
      return
    }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    updateMonitorState((current) => ({ ...current, reminders: { ...current.reminders, enabled: true, notificationPermissionRequested: true } }))
    if (permission !== 'granted') setReminderNotice({ key: `permission:${Date.now()}`, title: '应用内提醒已启用', body: '系统通知未获授权；提醒仍会显示在应用页面内。' })
  }
  function updateReminder<K extends keyof MonitorState['reminders']>(key: K, value: MonitorState['reminders'][K]) {
    updateMonitorState((current) => ({ ...current, reminders: { ...current.reminders, [key]: value } }))
  }
  function updateWeeklyFocusBudget(value: number) {
    setState((current) => ({ ...current, weeklyFocusBudgetMinutes: Number.isFinite(value) && value > 0 ? Math.min(3000, Math.round(value)) : 0 }))
  }
  function exportCalendar() {
    const items = buildAllGoalCalendarItems(state.goalSpaces)
    if (!items.length) return
    const blob = new Blob([exportCalendarToIcs(items)], { type: 'text/calendar;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = 'northstar-all-goals-calendar.ics'
    link.click()
    URL.revokeObjectURL(href)
  }
  function saveReview(mode: ReviewMode, result: string, obstacle: string, nextStep: string, plannedAction?: { doneWhen: string; scheduledAt: string }) {
    const date = localDateKey()
    if (mode === 'day') {
      updateMonitorState((current) => ({ ...current, dayReviews: [{ date, result, obstacle, nextStep }, ...current.dayReviews] }))
    } else {
      updateMonitorState((current) => ({
        ...current,
        weekReviews: [{ date, decision: mode, note: [result, obstacle, nextStep].filter(Boolean).join(' · ') }, ...current.weekReviews],
        ...(mode === 'week' && plannedAction && nextStep.trim() && plannedAction.doneWhen.trim() ? {
          tasks: [...current.tasks, {
            id: crypto.randomUUID(), title: nextStep.trim(),
            time: plannedAction.scheduledAt ? new Date(plannedAction.scheduledAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '待安排',
            duration: 30, doneWhen: plannedAction.doneWhen.trim(), evidence: '用户确认或添加证据链接', status: 'planned' as const, kind: 'build' as const,
            scheduledAt: plannedAction.scheduledAt || undefined,
          }],
        } : {}),
      }))
    }
    setReviewMode(null)
  }

  return (
    <div className="app-shell">
      {mobileNav && <button className="sidebar-backdrop" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Compass size={19} strokeWidth={1.8} /></div><div><strong>northstar</strong><span>GOAL MONITOR</span></div><button className="drawer-close icon-button" aria-label="关闭导航" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
        <div className="workspace-label">个人工作区 <ChevronDown size={13} /></div>
        <nav aria-label="主导航" className="main-nav">
          <div className="nav-caption">工作台</div>
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { setPage(id); setMobileNav(false) }}><Icon size={17} /><span>{label}</span>{id === 'today' && <span className="nav-count">{state.tasks.filter((task) => task.status === 'planned').length}</span>}</button>)}
        </nav>
        <div className="sidebar-project goal-space-picker">
          <div className="nav-caption">我的目标</div>
          <label><span>当前目标</span><select aria-label="切换目标" value={state.activeGoalSpaceId} onChange={(event) => { switchGoalSpace(event.target.value); setMobileNav(false) }}>{state.goalSpaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>
          <button className="goal-space-add" onClick={() => { setShowNewGoal(true); setMobileNav(false) }}><Plus size={14} />添加目标</button>
        </div>
        <div className="sidebar-bottom">
          <div className="sync-state"><span className="sync-dot" /><span>本机保存正常</span><span className="local-tag">LOCAL</span></div>
          <button className="profile" onClick={() => { setShowIntegrations(true); setMobileNav(false) }}><div className="avatar">U</div><span><b>个人账户</b><small>偏好与连接</small></span><MoreHorizontal size={16} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label={mobileNav ? '关闭导航' : '打开导航'} aria-expanded={mobileNav} onClick={() => setMobileNav((value) => !value)}><Menu size={19} /></button>
          <div className="breadcrumbs"><span>工作台</span><span className="crumb-slash">/</span><strong>{navItems.find((item) => item.id === page)?.label}</strong></div>
          <div className="top-actions"><div className="today-date"><CalendarDays size={15} />{todayLabel}</div><button className="icon-button notification-button" aria-label="提醒设置" onClick={() => setShowIntegrations(true)}><Bell size={17} /><i /></button><button className="top-avatar" aria-label="个人账户" onClick={() => setShowIntegrations(true)}>U</button></div>
        </header>

        <div className="content-wrap">
          {page === 'today' && <TodayPage state={state} progress={progress} done={done} metrics={state.goal.outcomeMetrics} onTaskStatus={updateTask} onStartTask={startTask} onAddTask={() => { setEditingTask(undefined); setShowTaskEditor(true) }} onEditTask={(task) => { setEditingTask(task); setShowTaskEditor(true) }} onEditMetric={setEditingMetric} onReview={() => setReviewMode('day')} onWeekReview={() => setReviewMode('week')} onGoalEdit={() => setShowGoalEditor(true)} onIntegrations={() => setShowIntegrations(true)} onOpenProject={() => setPage('project')} goalSpaces={state.goalSpaces} activeGoalSpaceId={state.activeGoalSpaceId} onOpenGoal={(goalSpaceId) => { switchGoalSpace(goalSpaceId); setPage('project') }} onGoalTaskStatus={updateGoalTask} onGoalTaskConfirm={confirmTask} weeklyFocusBudgetMinutes={state.weeklyFocusBudgetMinutes} onWeeklyBudgetChange={updateWeeklyFocusBudget} />}
          {page === 'calendar' && <CalendarPage goalSpaces={state.goalSpaces} onOpenGoal={(goalSpaceId) => { switchGoalSpace(goalSpaceId); setPage('project') }} onExportCalendar={exportCalendar} onStart={(goalSpaceId, taskId) => { updateGoalTask(goalSpaceId, taskId, 'in-progress') }} onConfirm={confirmTask} onStatus={updateGoalTask} />}
          {page === 'direction' && <DirectionPage state={state} onEdit={() => setShowGoalEditor(true)} />}
          {page === 'project' && <ProjectPage state={state} progress={progress} onTaskStatus={updateTask} onAddTask={() => { setEditingTask(undefined); setShowTaskEditor(true) }} onEditTask={(task) => { setEditingTask(task); setShowTaskEditor(true) }} onReview={(mode) => setReviewMode(mode)} />}
          {page === 'reviews' && <ReviewsPage state={state} onReview={(mode) => setReviewMode(mode)} />}
        </div>
        <footer className="footer"><span>Northstar <i>·</i> 把方向，变成今天的一步</span><button onClick={() => setShowIntegrations(true)}>连接与隐私 <ArrowRight size={13} /></button></footer>
      </main>

      {showGoalEditor && <GoalEditor goal={state.goal} onClose={() => setShowGoalEditor(false)} onSave={(goal) => { updateGoal(goal); setShowGoalEditor(false) }} />}
      {showNewGoal && <NewGoalModal onClose={() => setShowNewGoal(false)} onCreate={createGoalSpace} />}
      {editingMetric && <MetricUpdateModal metric={editingMetric} onClose={() => setEditingMetric(undefined)} onSave={(value, evidence) => { updateMetric(editingMetric.id, value, evidence); setEditingMetric(undefined) }} />}
      {showTaskEditor && <TaskEditor task={editingTask} onClose={() => setShowTaskEditor(false)} onSave={(title, doneWhen, scheduledAt, duration) => { addTask(title, doneWhen, scheduledAt, duration, editingTask?.id); setShowTaskEditor(false); setEditingTask(undefined) }} />}
      {reviewMode && <ReviewModal mode={reviewMode} tasks={state.tasks} metrics={state.goal.outcomeMetrics} onClose={() => setReviewMode(null)} onSave={(result, obstacle, nextStep, plannedAction) => saveReview(reviewMode, result, obstacle, nextStep, plannedAction)} />}
      {showIntegrations && <IntegrationModal state={state} onClose={() => setShowIntegrations(false)} onReset={() => setState(demoState)} onExportCalendar={exportCalendar} onEnableNotifications={enableNotifications} onReminderChange={updateReminder} />}
      {reminderNotice && <div className="reminder-toast" role="status"><b>{reminderNotice.title}</b><span>{reminderNotice.body}</span><button onClick={() => { if (reminderNotice.goalSpaceId) { switchGoalSpace(reminderNotice.goalSpaceId); setPage('project') } else if (reminderNotice.key.startsWith('daily:')) setReviewMode('day'); else if (reminderNotice.key.startsWith('weekly:')) setReviewMode('week'); setReminderNotice(null) }}>打开</button><button aria-label="关闭提醒" onClick={() => setReminderNotice(null)}>×</button></div>}
      {menuOpen && <div className="toast" role="status">当前数据保存在此浏览器中</div>}
      <button className="hidden-menu-toggle" onClick={() => { setMenuOpen((value) => !value); window.setTimeout(() => setMenuOpen(false), 2200) }} aria-label="本机存储状态"><MoreHorizontal size={16} /></button>
    </div>
  )
}

function TodayPage({ state, progress, done, metrics, onTaskStatus, onStartTask, onAddTask, onEditTask, onEditMetric, onReview, onWeekReview, onGoalEdit, onIntegrations, onOpenProject, goalSpaces, activeGoalSpaceId, onOpenGoal, onGoalTaskStatus, onGoalTaskConfirm, weeklyFocusBudgetMinutes, onWeeklyBudgetChange }: {
  state: MonitorState; progress: number; done: number; metrics: OutcomeMetric[]; onTaskStatus: (id: string, status: ActionTask['status']) => void; onStartTask: (id: string) => void; onAddTask: () => void; onEditTask: (task: ActionTask) => void; onEditMetric: (metric: OutcomeMetric) => void; onReview: () => void; onWeekReview: () => void; onGoalEdit: () => void; onIntegrations: () => void; onOpenProject: () => void; goalSpaces: GoalWorkspace[]; activeGoalSpaceId: string; onOpenGoal: (goalSpaceId: string) => void; onGoalTaskStatus: (goalSpaceId: string, taskId: string, status: ActionTask['status']) => void; onGoalTaskConfirm: (goalSpaceId: string, taskId: string) => void; weeklyFocusBudgetMinutes: number; onWeeklyBudgetChange: (minutes: number) => void
}) {
  const pendingCount = state.tasks.filter((task) => task.status === 'pending' || task.status === 'unobserved').length
  return <>
    <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" />{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()} <span className="eyebrow-dot">·</span> 一次只推进一件重要的事</div><h1>早上好，<em>向前一步。</em></h1><p className="welcome-copy">把注意力放回今天能做的事。计划是起点，留下的成果才是进展。</p></div><button className="button button-quiet" onClick={onGoalEdit}><Target size={15} />编辑方向</button></section>

    <section className="direction-strip"><div className="direction-icon"><Compass size={18} /></div><div className="direction-main"><span className="section-kicker">当前人生方向</span><strong>{state.goal.direction}</strong></div><div className="direction-divider" /><div className="direction-goal"><span className="section-kicker">年度里程碑</span><strong>{state.goal.annualMilestone}</strong></div><button className="strip-arrow" aria-label="查看目标地图"><ArrowRight size={17} /></button></section>

    {goalSpaces.length > 1 && <TodayAcrossGoals goalSpaces={goalSpaces} activeGoalSpaceId={activeGoalSpaceId} onOpenGoal={onOpenGoal} onStatus={onGoalTaskStatus} onConfirm={onGoalTaskConfirm} />}
    <WeeklyCapacityCard goalSpaces={goalSpaces} budgetMinutes={weeklyFocusBudgetMinutes} onBudgetChange={onWeeklyBudgetChange} />

    <div className="dashboard-grid">
      <section className="today-column">
        <div className="section-heading"><div><div className="heading-overline">DAILY LEVERS · THIS WEEK <span className="heading-number">01 — 03</span></div><h2>今日与本周行动</h2></div><button className="text-button" onClick={onAddTask}><Plus size={15} />添加任务</button></div>
        <div className="task-stack">
          {state.tasks.map((task, index) => <TaskCard key={task.id} task={task} index={index} onStatus={onTaskStatus} onEdit={onEditTask} />)}
          {state.tasks.length === 0 && <div className="empty-card"><Circle size={20} /><b>今天还没有行动</b><span>从本月项目里挑一个最小的下一步。</span><button className="button button-primary" onClick={onAddTask}><Plus size={15} />添加第一个行动</button></div>}
        </div>
        <div className="calendar-note"><div className="calendar-note-icon"><Clock3 size={15} /></div><span>专注时间代表你的<strong>计划投入</strong>，任务证据代表<strong>实际产出</strong>。</span><button onClick={onIntegrations}>日历导出 <ExternalLink size={12} /></button></div>
        <section className="review-prompt"><div className="review-prompt-copy"><span className="section-kicker">END OF DAY · 3 MIN</span><h3>今天留下了什么？</h3><p>用一个简短回顾，把今天的经验接到下一步。</p></div><button className="button button-dark" onClick={onReview}>开始日终回顾 <ArrowRight size={15} /></button></section>
      </section>

      <aside className="insight-column">
        <section className="project-card"><div className="project-card-top"><span className="project-label"><span className="project-dot" />30 DAY PROJECT</span><button className="more-button" aria-label="项目选项"><MoreHorizontal size={18} /></button></div><h3>{state.goal.project}</h3><p>{state.goal.projectOutcome}</p><div className="progress-label"><span>本周行动进度</span><b>{done} / {state.tasks.length}</b></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="checkpoint"><span className="checkpoint-icon"><Flag size={14} /></span><div><small>本周检查点</small><strong>{state.goal.weeklyCheckpoint}</strong></div></div><button className="project-link" onClick={onWeekReview}>查看项目进度 <ArrowRight size={14} /></button></section>

        <OutcomeMetricsCard metrics={metrics} onAdd={onGoalEdit} onEdit={onEditMetric} />
        <DailyFeedbackCard tasks={state.tasks} onStartTask={onStartTask} onAddTask={onAddTask} onOpenProject={onOpenProject} />

        <section className="signal-card"><div className="section-heading compact"><div><div className="heading-overline">PROGRESS SIGNALS</div><h2>进展信号</h2></div><span className="signal-period">本周</span></div><div className="signal-row"><div className="signal-symbol teal"><CheckCircle2 size={16} /></div><div className="signal-text"><strong>已确认产出</strong><small>来自明确证据或你的确认</small></div><b className="signal-value">{done}</b></div><div className="signal-row"><div className="signal-symbol amber"><FileCheck2 size={16} /></div><div className="signal-text"><strong>待确认</strong><small>证据不足不等于没完成</small></div><b className="signal-value">{pendingCount}</b></div><div className="signal-row"><div className="signal-symbol blue"><ArrowUpRight size={16} /></div><div className="signal-text"><strong>外部反馈</strong><small>回复、面试、职业交流</small></div><b className="signal-value muted">—</b></div><div className="signal-foot"><span>缺少数据时不会自动判定失败</span><span className="info-dot">i</span></div></section>

        <button className="week-review-link" onClick={onWeekReview}><span className="week-review-icon"><CalendarDays size={16} /></span><span><b>周日 · 每周复盘</b><small>计划、产出、阻碍和下周调整</small></span><ArrowRight size={16} /></button>
      </aside>
    </div>
    <div className="insight-banner"><div className="banner-mark"><Sparkles size={16} /></div><span><b>两周检查点</b> · 如果有行动却没有看见进展，回头检查做的是否是有效杠杆，而不是只增加时长。</span><span className="banner-date">第 14 天 <ArrowDownRight size={14} /></span></div>
  </>
}

function WeeklyCapacityCard({ goalSpaces, budgetMinutes, onBudgetChange }: { goalSpaces: GoalWorkspace[]; budgetMinutes: number; onBudgetChange: (minutes: number) => void }) {
  const summary = buildWeeklyCapacitySummary(goalSpaces, budgetMinutes)
  const isOver = summary.budgetMinutes > 0 && summary.scheduledMinutes > summary.budgetMinutes
  const progress = summary.budgetMinutes > 0 ? Math.min(100, Math.round(summary.scheduledMinutes / summary.budgetMinutes * 100)) : 0
  return <section className="weekly-capacity-card" aria-label="本周时间预算">
    <div className="weekly-capacity-heading"><div><span className="section-kicker">WEEKLY CAPACITY · {summary.startDate} — {summary.endDate}</span><h2>本周专注时间安排</h2></div><span>{summary.scheduledCount} 项已排期</span></div>
    <div className="weekly-capacity-body"><div className="weekly-capacity-total"><strong>{summary.scheduledMinutes} 分钟</strong><span>跨目标排期估算 · 不代表实际用时</span>{summary.budgetMinutes > 0 && <b className={isOver ? 'capacity-over' : ''}>{isOver ? `超出预算 ${summary.scheduledMinutes - summary.budgetMinutes} 分钟` : `每周预算剩余 ${summary.budgetMinutes - summary.scheduledMinutes} 分钟`}</b>}</div><label className="weekly-capacity-input"><span>每周可投入分钟</span><input aria-label="每周可投入分钟" type="number" min="0" max="3000" step="15" value={budgetMinutes || ''} onChange={(event) => onBudgetChange(Number(event.target.value))} placeholder="未设置" /></label></div>
    {summary.budgetMinutes > 0 && <div className="weekly-capacity-progress" role="progressbar" aria-label="本周排期预算使用率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span className={isOver ? 'capacity-bar-over' : ''} style={{ width: `${progress}%` }} /></div>}
    <p>{summary.budgetMinutes === 0 ? '设定你每周能稳定保护的时间，系统会比较跨目标排期与预算。' : isOver ? '排期超过了你的周预算。可以手动改期或缩小行动；系统不会自动调整。' : '这是排期与预算的对照，不会把专注时间当作成果。'}</p>
  </section>
}

function TodayAcrossGoals({ goalSpaces, activeGoalSpaceId, onOpenGoal, onStatus, onConfirm }: { goalSpaces: GoalWorkspace[]; activeGoalSpaceId: string; onOpenGoal: (goalSpaceId: string) => void; onStatus: (goalSpaceId: string, taskId: string, status: ActionTask['status']) => void; onConfirm: (goalSpaceId: string, taskId: string) => void }) {
  const items = buildTodayGoalActions(goalSpaces, activeGoalSpaceId)
  const statusLabels: Record<ActionTask['status'], string> = { planned: '计划中', 'in-progress': '进行中', confirmed: '已确认', pending: '待核实', unobserved: '未观察', rescheduled: '已改期', skipped: '已跳过' }
  return <section className="today-across-goals" aria-label="其他目标的今日行动">
    <div className="today-across-heading"><div><span className="section-kicker">OTHER GOALS · TODAY</span><h2>其他目标的今日行动</h2></div><span>{items.length} 项</span></div>
    {items.length ? <div className="today-across-list">{items.map(({ goalSpaceId, goalName, task }) => <article className="today-across-item" key={`${goalSpaceId}-${task.id}`}>
      <time>{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(task.scheduledAt!))}</time>
      <div className="today-across-main"><span className="agenda-goal-tag">{goalName}</span><strong>{task.title}</strong><small>{statusLabels[task.status]} · {task.duration} 分钟</small><span>完成标准：{task.doneWhen}</span>{task.evidenceNote && <span className="agenda-evidence-note">完成记录：{task.evidenceNote}</span>}</div>
      <div className="agenda-item-actions">{(task.status === 'planned' || task.status === 'rescheduled') && <button className="agenda-action" onClick={() => onStatus(goalSpaceId, task.id, 'in-progress')}>开始</button>}{(task.status === 'in-progress' || task.status === 'pending' || task.status === 'unobserved') && <button className="agenda-action" onClick={() => onConfirm(goalSpaceId, task.id)}>确认完成</button>}{task.status !== 'confirmed' && <button className="agenda-skip" onClick={() => onStatus(goalSpaceId, task.id, 'skipped')}>跳过</button>}{task.status === 'confirmed' && <span className="today-across-confirmed">已记录</span>}<button className="agenda-open-goal" onClick={() => onOpenGoal(goalSpaceId)}>查看目标</button></div>
    </article>)}</div> : <p className="today-across-empty">其他目标今天没有排期行动。</p>}
  </section>
}

function CalendarPage({ goalSpaces, onOpenGoal, onExportCalendar, onStart, onConfirm, onStatus }: { goalSpaces: GoalWorkspace[]; onOpenGoal: (goalSpaceId: string) => void; onExportCalendar: () => void; onStart: (goalSpaceId: string, taskId: string) => void; onConfirm: (goalSpaceId: string, taskId: string) => void; onStatus: (goalSpaceId: string, taskId: string, status: ActionTask['status']) => void }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const agenda = buildGoalAgenda(goalSpaces, weekOffset)
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${agenda.startDate}T00:00:00`)
    date.setDate(date.getDate() + index)
    return { key: localDateKey(date), label: new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(date) }
  })
  const statusLabels: Record<ActionTask['status'], string> = { planned: '计划中', 'in-progress': '进行中', confirmed: '已确认', pending: '待核实', unobserved: '未观察', rescheduled: '已改期', skipped: '已跳过' }
  return <>
    <section className="subpage-header calendar-page-header"><div><div className="eyebrow"><span className="eyebrow-line" />ALL GOALS · WEEKLY AGENDA</div><h1>所有目标的<em>日历</em></h1><p>把不同目标的已排期行动放在同一周里看。日历只显示排期，不代表行动已完成。</p></div><div className="calendar-page-actions"><div className="calendar-week-controls"><button className="button button-quiet" aria-label="上一周" onClick={() => setWeekOffset((value) => value - 1)}>‹</button><strong>{agenda.startDate} — {agenda.endDate}</strong><button className="button button-quiet" aria-label="下一周" onClick={() => setWeekOffset((value) => value + 1)}>›</button></div><button className="button button-primary" onClick={onExportCalendar}><CalendarDays size={14} />导出所有目标 .ics</button></div></section>
    <section className="agenda-week" aria-label="所有目标周日历">
      {dates.map((date) => {
        const items = agenda.items.filter((item) => item.dateKey === date.key)
        return <article className={`agenda-day ${items.length ? 'has-items' : ''}`} key={date.key}>
          <div className="agenda-day-heading"><strong>{date.label}</strong><small>{items.length ? `${items.length} 项` : '无排期'}</small></div>
          {items.length ? <div className="agenda-day-items">{items.map(({ goalSpaceId, goalName, task }) => <div className="agenda-item" key={`${goalSpaceId}-${task.id}`}>
            <span className="agenda-item-time">{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(task.scheduledAt!))}</span>
            <div className="agenda-item-main"><span className="agenda-goal-tag">{goalName}</span><strong>{task.title}</strong><small>{statusLabels[task.status]} · {task.duration} 分钟</small><span className="agenda-done-when">完成标准：{task.doneWhen}</span>{task.evidenceNote && <span className="agenda-evidence-note">完成记录：{task.evidenceNote}</span>}</div>
            <div className="agenda-item-actions">{task.status === 'planned' || task.status === 'rescheduled' ? <button className="agenda-action" onClick={() => onStart(goalSpaceId, task.id)}>开始</button> : task.status === 'in-progress' || task.status === 'pending' || task.status === 'unobserved' ? <button className="agenda-action" onClick={() => onConfirm(goalSpaceId, task.id)}>确认完成</button> : null}{task.status === 'skipped' ? <button className="agenda-action" onClick={() => onStatus(goalSpaceId, task.id, 'planned')}>恢复</button> : task.status !== 'confirmed' ? <button className="agenda-skip" onClick={() => onStatus(goalSpaceId, task.id, 'skipped')}>跳过</button> : null}<button className="agenda-open-goal" onClick={() => onOpenGoal(goalSpaceId)}>查看目标</button></div>
          </div>)}</div> : <span className="agenda-empty-day">—</span>}
        </article>
      })}
      {agenda.items.length === 0 && <div className="agenda-empty"><CalendarDays size={20} /><b>这一周还没有已排期的行动</b><span>打开一个目标，在项目行动中安排日期和时间。</span></div>}
    </section>
    <p className="agenda-footnote">显示所有目标工作区中的排期行动；改期或确认状态后会自动反映在这里。</p>
  </>
}

function OutcomeMetricsCard({ metrics, onAdd, onEdit }: { metrics: OutcomeMetric[]; onAdd: () => void; onEdit: (metric: OutcomeMetric) => void }) {
  return <section className="outcome-metrics-card" aria-label="职业与财务结果指标">
    <div className="outcome-metrics-heading"><div><b>结果指标</b><small>长期结果 · 手动更新</small></div><span>OUTCOME</span></div>
    {metrics.length === 0 ? <><p>把职业或财务目标写成一个可观察的结果，例如年薪、月储蓄或面试数。当前没有预填金额。</p><button className="suggestion-action" onClick={onAdd}>设置结果指标 <ArrowRight size={14} /></button></>
      : <div className="outcome-metric-list">{metrics.map((metric) => {
        const progress = metricProgress(metric)
        const history = metric.history || []
        const chartValues = [metric.baseline, ...history.map((point) => point.value), metric.target]
        const chartPoints = metricTrendCoordinates(chartValues)
        const historyPoints = chartPoints.slice(1, -1)
        return <article className="outcome-metric" key={metric.id}>
          <div className="outcome-metric-title"><strong>{metric.name}</strong><small>{metric.direction === 'increase' ? '目标上升' : '目标下降'}</small></div>
          <div className="outcome-metric-values"><span>基线 {metric.baseline} {metric.unit}</span><span>当前 <b>{metric.current} {metric.unit}</b></span><span>目标 {metric.target} {metric.unit}</span></div>
          {progress !== null && <><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><small className="metric-progress-label">从基线到目标 {progress}%</small></>}
          <div className="metric-trend" aria-label={`${metric.name}历史趋势`}>
            <div className="metric-trend-heading"><b>记录趋势</b><small>{history.length} 次记录</small></div>
            {history.length > 0 ? <svg viewBox="0 0 240 60" role="img" aria-label={`${metric.name}历史值与基线、目标对比`} preserveAspectRatio="none">
              <line x1="8" y1={chartPoints[0].y} x2="232" y2={chartPoints[0].y} className="metric-trend-baseline" />
              <line x1="8" y1={chartPoints[chartPoints.length - 1].y} x2="232" y2={chartPoints[chartPoints.length - 1].y} className="metric-trend-target" />
              {historyPoints.length > 1 && <polyline points={historyPoints.map((point) => `${point.x},${point.y}`).join(' ')} className="metric-trend-line" />}
              {historyPoints.map((point, index) => <circle key={`${history[index].recordedAt}-${index}`} cx={point.x} cy={point.y} r="3" className="metric-trend-point"><title>{`${history[index].recordedAt.slice(0, 10)} · ${point.value} ${metric.unit}`}</title></circle>)}
            </svg> : <p>保存当前值后，这里会逐步显示趋势。</p>}
          </div>
          <small className="metric-updated">更新于 {metric.updatedAt}{metric.evidenceNote ? ` · ${metric.evidenceNote}` : ''}</small>
          <button className="suggestion-action" onClick={() => onEdit(metric)}>更新当前值 <ArrowRight size={14} /></button>
        </article>
      })}<button className="add-metric-link" onClick={onAdd}>编辑结果指标设置</button></div>}
  </section>
}

function DailyFeedbackCard({ tasks, onStartTask, onAddTask, onOpenProject }: { tasks: ActionTask[]; onStartTask: (id: string) => void; onAddTask: () => void; onOpenProject: () => void }) {
  const feedback = buildDailyProgressFeedback(tasks)
  return <section className="daily-feedback-card" aria-label="今日进度反馈">
    <div className="daily-feedback-header"><span className="ai-icon"><Sparkles size={15} /></span><div><b>今日进度反馈</b><small>本地规则 · 基于行动状态，不是 AI</small></div></div>
    <h3>{feedback.headline}</h3>
    <p>{feedback.detail}</p>
    <div className="feedback-metrics"><span>今日排期 <b>{feedback.scheduledCount}</b></span><span>已确认 <b>{feedback.confirmedCount}</b></span><span>待核实 <b>{feedback.waitingCount}</b></span></div>
    {feedback.nextTask ? <div className="feedback-next"><small>{feedback.nextTask.status === 'in-progress' ? '正在推进' : '建议下一步'}</small><strong>{feedback.nextTask.title}</strong><p>完成标准：{feedback.nextTask.doneWhen}</p><button className="suggestion-action" onClick={() => onStartTask(feedback.nextTask!.id)}>{feedback.nextTask.status === 'in-progress' ? '继续这项行动' : '开始这项行动'} <ArrowRight size={14} /></button></div>
      : feedback.waitingCount > 0 ? <button className="suggestion-action" onClick={onOpenProject}>查看待核实行动 <ArrowRight size={14} /></button>
        : feedback.scheduledCount === 0 && tasks.length === 0 ? <button className="suggestion-action" onClick={onAddTask}>添加第一项行动 <ArrowRight size={14} /></button>
          : <button className="suggestion-action" onClick={onOpenProject}>查看项目行动 <ArrowRight size={14} /></button>}
  </section>
}

function TaskCard({ task, index, onStatus, onEdit }: { task: ActionTask; index: number; onStatus: (id: string, status: ActionTask['status']) => void; onEdit: (task: ActionTask) => void }) {
  const isDone = task.status === 'confirmed'
  const statusLabel = task.status === 'pending' ? '待确认' : task.status === 'unobserved' ? '未观察到' : task.status === 'confirmed' ? '已确认' : task.status === 'in-progress' ? '进行中' : task.status === 'skipped' ? '已跳过' : '计划中'
  const kindLabel = task.kind === 'research' ? '研究' : task.kind === 'share' ? '外部验证' : '制作'
  return <article className={`task-card ${isDone ? 'task-done' : ''}`}>
    <button className={`task-check ${isDone ? 'checked' : ''}`} aria-label={isDone ? `撤销${task.title}完成` : `确认${task.title}完成`} onClick={() => onStatus(task.id, isDone ? 'planned' : 'confirmed')}>{isDone && <Check size={14} />}</button>
    <div className="task-body"><div className="task-topline"><span className={`task-type type-${task.kind}`}>{kindLabel}</span><span className={`task-status status-${task.status}`}>{statusLabel}</span></div><h3>{task.title}</h3><p className="task-done-when"><span className="done-when-label">完成标准</span>{task.doneWhen}</p><div className="task-meta"><span><Clock3 size={13} />{task.time} · {task.duration} 分钟</span><span><FileCheck2 size={13} />证据：{task.evidence}</span></div></div>
    <div className="task-actions"><button title="安排时间" aria-label={`安排${task.title}`} onClick={() => onEdit(task)}><CalendarDays size={14} /></button><button title="标记待确认" aria-label="标记待确认" onClick={() => onStatus(task.id, 'pending')}><FileCheck2 size={15} /></button><button title="标记未观察到" aria-label="标记未观察到" onClick={() => onStatus(task.id, 'unobserved')}><Circle size={13} /></button></div>
    {index === 0 && <div className="task-today-badge">TODAY</div>}
  </article>
}

function DirectionPage({ state, onEdit }: { state: MonitorState; onEdit: () => void }) {
  return <section className="subpage"><div className="subpage-header"><div><div className="eyebrow"><span className="eyebrow-line" />DIRECTION MAP</div><h1>让今天的行动，<em>连到更远的地方。</em></h1><p>目标是方向；项目把方向变成系统，杠杆行动让系统每天发生。</p></div><button className="button button-primary" onClick={onEdit}>编辑方向</button></div><div className="goal-map"><GoalNode label="五年方向 · 2031" icon={<Compass size={17} />} text={state.goal.direction} accent="navy" /><div className="map-connector"><span /><small>逐步积累能力与选择权</small></div><GoalNode label="12 个月里程碑" icon={<Flag size={17} />} text={state.goal.annualMilestone} accent="blue" /><div className="map-connector"><span /><small>通过一组可交付项目验证路径</small></div><GoalNode label="当前 30 天项目" icon={<FolderKanban size={17} />} text={state.goal.project} sub={state.goal.projectOutcome} accent="teal" /></div><div className="direction-footnote"><Sparkles size={15} /><span>这条目标路径是可编辑草案。系统会帮助发现偏差，但人生方向由你确认。</span></div></section>
}

function GoalNode({ label, icon, text, sub, accent }: { label: string; icon: React.ReactNode; text: string; sub?: string; accent: string }) {
  return <article className={`goal-node node-${accent}`}><div className="node-top"><span className="node-icon">{icon}</span><span>{label}</span><span className="node-status">活跃方向</span></div><h3>{text}</h3>{sub && <p>{sub}</p>}</article>
}

function ProjectPage({ state, progress, onTaskStatus, onAddTask, onEditTask, onReview }: { state: MonitorState; progress: number; onTaskStatus: (id: string, status: ActionTask['status']) => void; onAddTask: () => void; onEditTask: (task: ActionTask) => void; onReview: (mode: ReviewMode) => void }) {
  return <section className="subpage"><div className="subpage-header"><div><div className="eyebrow"><span className="eyebrow-line" />ACTIVE PROJECT · 30 DAYS</div><h1>{state.goal.project}</h1><p>{state.goal.projectOutcome}</p></div><button className="button button-primary" onClick={onAddTask}><Plus size={15} />添加行动</button></div><div className="project-overview"><div className="project-overview-main"><span className="section-kicker">本月成果</span><h2>{state.goal.projectOutcome}</h2><div className="progress-track large"><span style={{ width: `${progress}%` }} /></div><div className="progress-caption"><span>任务产出进度</span><b>{progress}%</b></div></div><div className="project-overview-stat"><span>时间预算</span><strong>{state.goal.timeBudget}</strong><small>按现实日程调整</small></div></div><div className="section-heading project-task-heading"><div><div className="heading-overline">PROJECT ACTIONS</div><h2>行动与证据</h2></div><button className="text-button" onClick={() => onReview('fortnight')}>进行双周检查 <ArrowRight size={14} /></button></div><div className="project-task-list">{state.tasks.map((task, index) => <TaskCard key={task.id} task={task} index={index} onStatus={onTaskStatus} onEdit={onEditTask} />)}</div><div className="project-review-options"><button onClick={() => onReview('week')}><CalendarDays size={16} /><span>每周复盘</span><ArrowRight size={14} /></button><button onClick={() => onReview('month')}><Flag size={16} /><span>月末项目决策</span><ArrowRight size={14} /></button></div></section>
}

function ReviewsPage({ state, onReview }: { state: MonitorState; onReview: (mode: ReviewMode) => void }) {
  return <section className="subpage"><div className="subpage-header"><div><div className="eyebrow"><span className="eyebrow-line" />REFLECT & ADJUST</div><h1>复盘不是打分，<em>是找到下一步。</em></h1><p>看实际行动留下了什么，再决定继续、缩小或调整。</p></div></div><div className="review-actions-grid">{([['day', '日终回顾', '每天 · 3 分钟', '记录成果、障碍与明天最小的一步'], ['week', '每周复盘', '每周 · 10 分钟', '对照检查点，决定下周只调整一件事'], ['fortnight', '双周方向检查', '第 14 天 · 10 分钟', '没有可见进展时，检查杠杆和项目假设'], ['month', '月末项目决策', '每月 · 20 分钟', '决定继续、调整或结束当前项目']] as [ReviewMode, string, string, string][]).map(([mode, title, cadence, description]) => <button className="review-action-card" key={mode} onClick={() => onReview(mode)}><span className="review-action-icon"><RefreshCw size={17} /></span><span className="section-kicker">{cadence}</span><b>{title}</b><small>{description}</small><ArrowRight className="review-action-arrow" size={16} /></button>)}</div><div className="history-card"><div className="section-heading compact"><div><div className="heading-overline">RECENT NOTES</div><h2>最近的复盘</h2></div></div>{state.dayReviews.length === 0 && state.weekReviews.length === 0 ? <div className="history-empty"><span className="history-empty-icon"><FileCheck2 size={17} /></span><span><b>还没有复盘记录</b><small>完成第一次简短回顾后，这里会显示你调整计划的依据。</small></span></div> : <div className="review-history">{state.dayReviews.map((item) => <div className="history-row" key={item.date + item.nextStep}><span className="history-date">{item.date}</span><b>日终回顾</b><span>{[item.result, item.nextStep].filter(Boolean).join(' · ') || '已保存回顾'}</span></div>)}{state.weekReviews.map((item) => <div className="history-row" key={item.date + item.note}><span className="history-date">{item.date}</span><b>{item.decision === 'fortnight' ? '双周检查' : item.decision === 'month' ? '月末回顾' : '每周复盘'}</b><span>{item.note || '已保存决定'}</span></div>)}</div>}</div></section>
}

function NewGoalModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, direction: string) => void }) {
  const [name, setName] = useState('')
  const [direction, setDirection] = useState('')
  return <ModalFrame title="添加一个目标" subtitle="每个目标会有独立的项目、行动、结果指标和复盘记录。" onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (name.trim() && direction.trim()) onCreate(name.trim(), direction.trim()) }}><label className="field"><span>目标名称</span><input autoFocus placeholder="例如：职业发展、财务安全、家庭" value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="field"><span>五年方向</span><textarea placeholder="五年后希望什么变得不一样？" value={direction} onChange={(event) => setDirection(event.target.value)} rows={3} required /></label><div className="modal-hint"><Target size={14} />创建后，再补充 12 个月里程碑、30 天项目和每周行动。</div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>取消</button><button type="submit" className="button button-primary">创建目标</button></div></form></ModalFrame>
}

function GoalEditor({ goal, onClose, onSave }: { goal: GoalPlan; onClose: () => void; onSave: (goal: GoalPlan) => void }) {
  const [form, setForm] = useState(goal)
  const [metricDraft, setMetricDraft] = useState<{ name: string; unit: string; direction: OutcomeMetric['direction']; baseline: string; target: string; current: string }>({ name: '', unit: 'AUD / year', direction: 'increase', baseline: '', target: '', current: '' })
  const [metricError, setMetricError] = useState('')
  const fields: [Exclude<keyof GoalPlan, 'outcomeMetrics'>, string, boolean][] = [['direction', '五年方向', false], ['annualMilestone', '12 个月里程碑', false], ['project', '当前 30 天项目', false], ['projectOutcome', '本月成果定义', false], ['weeklyCheckpoint', '本周检查点', false], ['constraints', '现实限制', true], ['timeBudget', '每周可投入时间', false]]
  function addMetric() {
    const candidate = { name: metricDraft.name.trim(), unit: metricDraft.unit.trim(), baseline: Number(metricDraft.baseline), target: Number(metricDraft.target), current: Number(metricDraft.current) }
    if (!isValidMetric(candidate)) {
      setMetricError('请填写名称、单位、有效数字，并设置不同的基线和目标值。')
      return
    }
    const metric: OutcomeMetric = { ...candidate, id: crypto.randomUUID(), direction: metricDraft.direction, updatedAt: localDateKey(), history: [{ recordedAt: new Date().toISOString(), value: candidate.current }] }
    setForm((current) => ({ ...current, outcomeMetrics: [...(current.outcomeMetrics || []), metric] }))
    setMetricDraft({ name: '', unit: 'AUD / year', direction: 'increase', baseline: '', target: '', current: '' })
    setMetricError('')
  }
  return <ModalFrame title="编辑你的方向" subtitle="这些内容是你的计划，不是系统替你做出的承诺。" onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>{fields.map(([key, label, multiline]) => <label className="field" key={key}><span>{label}</span>{multiline ? <textarea value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} rows={2} /> : <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</label>)}<section className="metric-editor"><div className="settings-heading"><b>职业/财务结果指标 · 可选</b><small>自己填写基线与目标，不连接银行账户</small></div>{(form.outcomeMetrics || []).map((metric) => <div className="metric-editor-row" key={metric.id}><span><b>{metric.name}</b><small>{metric.baseline} → {metric.target} {metric.unit}</small></span><button type="button" className="reset-link" aria-label={`移除${metric.name}`} onClick={() => setForm((current) => ({ ...current, outcomeMetrics: current.outcomeMetrics.filter((item) => item.id !== metric.id) }))}>移除</button></div>)}<label className="field"><span>指标名称</span><input placeholder="例如：年薪、月储蓄、面试数" value={metricDraft.name} onChange={(event) => setMetricDraft({ ...metricDraft, name: event.target.value })} /></label><div className="schedule-fields"><label className="field"><span>单位</span><input placeholder="AUD / year" value={metricDraft.unit} onChange={(event) => setMetricDraft({ ...metricDraft, unit: event.target.value })} /></label><label className="field"><span>目标方向</span><select value={metricDraft.direction} onChange={(event) => setMetricDraft({ ...metricDraft, direction: event.target.value as OutcomeMetric['direction'] })}><option value="increase">提高</option><option value="decrease">降低</option></select></label></div><div className="schedule-fields"><label className="field"><span>起始基线</span><input type="number" step="any" value={metricDraft.baseline} onChange={(event) => setMetricDraft({ ...metricDraft, baseline: event.target.value })} /></label><label className="field"><span>目标值</span><input type="number" step="any" value={metricDraft.target} onChange={(event) => setMetricDraft({ ...metricDraft, target: event.target.value })} /></label></div><label className="field"><span>当前值</span><input type="number" step="any" value={metricDraft.current} onChange={(event) => setMetricDraft({ ...metricDraft, current: event.target.value })} /></label>{metricError && <small className="metric-error" role="alert">{metricError}</small>}<button type="button" className="button button-quiet" onClick={addMetric}>添加结果指标</button></section><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>取消</button><button type="submit" className="button button-primary">保存方向</button></div></form></ModalFrame>
}

function MetricUpdateModal({ metric, onClose, onSave }: { metric: OutcomeMetric; onClose: () => void; onSave: (current: number, evidence: string) => void }) {
  const [value, setValue] = useState(String(metric.current))
  const [evidence, setEvidence] = useState(metric.evidenceNote || '')
  const [error, setError] = useState('')
  return <ModalFrame title={`更新${metric.name}`} subtitle="只更新你想记录的结果信号；行动完成不自动改变此数值。" onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); const current = Number(value); if (!Number.isFinite(current)) { setError('请输入有效数字。'); return } onSave(current, evidence) }}><div className="metric-update-context"><span>基线 {metric.baseline} {metric.unit}</span><span>目标 {metric.target} {metric.unit}</span></div><label className="field"><span>当前值（{metric.unit}）</span><input autoFocus type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} required /></label><label className="field"><span>数据来源或备注（可选）</span><textarea rows={2} placeholder="例如：工资单、月底预算记录" value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>{error && <small className="metric-error" role="alert">{error}</small>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>取消</button><button type="submit" className="button button-primary">保存当前值</button></div></form></ModalFrame>
}

function TaskEditor({ task, onClose, onSave }: { task?: ActionTask; onClose: () => void; onSave: (title: string, doneWhen: string, scheduledAt: string, duration: number) => void }) {
  const [title, setTitle] = useState(task?.title || '')
  const [doneWhen, setDoneWhen] = useState(task?.doneWhen || '')
  const [scheduledAt, setScheduledAt] = useState(task?.scheduledAt ? task.scheduledAt.slice(0, 16) : '')
  const [duration, setDuration] = useState(task?.duration || 30)
  return <ModalFrame title={task ? '安排行动' : '添加杠杆行动'} subtitle="写一个能在单次专注块完成，并且能留下证据的动作。" onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (title.trim() && doneWhen.trim()) onSave(title.trim(), doneWhen.trim(), scheduledAt, duration) }}><label className="field"><span>行动</span><input autoFocus placeholder="例如：跑通一个数据质量检查" value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label className="field"><span>完成标准</span><textarea placeholder="结束时我会看到什么结果？" value={doneWhen} onChange={(event) => setDoneWhen(event.target.value)} rows={3} required /></label><div className="schedule-fields"><label className="field"><span>专注时间（可选）</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label><label className="field"><span>时长（分钟）</span><input type="number" min="5" max="480" step="5" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label></div><div className="modal-hint"><FileCheck2 size={14} />计划时间是投入；完成后再确认产出证据。排期会保存在本机。</div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>取消</button><button type="submit" className="button button-primary">{task ? '保存行动' : '添加行动'}</button></div></form></ModalFrame>
}

function ReviewModal({ mode, tasks, metrics, onClose, onSave }: { mode: ReviewMode; tasks: ActionTask[]; metrics: OutcomeMetric[]; onClose: () => void; onSave: (result: string, obstacle: string, nextStep: string, plannedAction?: { doneWhen: string; scheduledAt: string }) => void }) {
  const [result, setResult] = useState('')
  const [obstacle, setObstacle] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [addNextAction, setAddNextAction] = useState(false)
  const [nextActionDoneWhen, setNextActionDoneWhen] = useState('')
  const [nextActionScheduledAt, setNextActionScheduledAt] = useState('')
  const titles: Record<ReviewMode, [string, string]> = {
    day: ['日终回顾', '今天留下了什么？'], week: ['每周复盘', '这一周，什么真正推动了项目？'],
    fortnight: ['双周方向检查', '这两周有可见进展吗？'], month: ['月末项目决策', '接下来继续、调整，还是结束？'],
  }
  const isDay = mode === 'day'
  const periodContext = buildReviewProgressContext(tasks, mode)
  const metricContexts = buildMetricReviewContext(metrics, mode)
  return <ModalFrame title={titles[mode][0]} subtitle={titles[mode][1]} onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (addNextAction && (!nextStep.trim() || !nextActionDoneWhen.trim())) return; onSave(result, obstacle, nextStep, addNextAction ? { doneWhen: nextActionDoneWhen, scheduledAt: nextActionScheduledAt } : undefined) }}><div className="review-context"><span className="review-context-icon"><Sparkles size={15} /></span><span>{mode === 'day' ? '不需要给今天打分。写下证据、障碍和下一步就够了。' : '系统会保留你的决定与依据。AI 建议仅供参考，由你确认。'}</span></div><div className="review-summary"><div><b>自动汇总 · 当前任务状态</b><span>{periodContext.startDate} 至 {periodContext.endDate}</span></div><p>{periodContext.observation}</p><small>{periodContext.prompt}</small></div>{metricContexts.length > 0 && <section className="review-metric-summary" aria-label="区间结果指标"><div><b>区间结果信号</b><small>手动记录 · 与行动状态分开</small></div>{metricContexts.map((metric) => <article key={metric.id}><strong>{metric.name}</strong><small>{metric.recordedCount} 次记录 · {metric.observation}</small></article>)}<p>同一时期出现的变化不代表行动造成了结果。</p></section>}<label className="field"><span>{isDay ? '今天实际留下了什么？' : '发生了什么进展？'}</span><textarea autoFocus rows={2} placeholder="例如：完成了岗位技能对比，确定案例方向……" value={result} onChange={(event) => setResult(event.target.value)} /></label><label className="field"><span>什么卡住了或需要调整？</span><textarea rows={2} placeholder="可以留空；没记录不等于失败。" value={obstacle} onChange={(event) => setObstacle(event.target.value)} /></label><label className="field"><span>{isDay ? '下一步最小动作' : '下一阶段的决定 / 下一步'}</span><textarea rows={2} placeholder="例如：明天先跑通一条质量检查。" value={nextStep} onChange={(event) => setNextStep(event.target.value)} /></label>{mode !== 'day' && <div className="decision-options"><button type="button" onClick={() => setNextStep('继续当前项目，保持现有节奏')}>继续</button><button type="button" onClick={() => setNextStep('缩小任务范围，降低开始门槛')}>缩小</button><button type="button" onClick={() => setNextStep('调整行动或重新检查项目假设')}>调整</button></div>}{mode === 'week' && <section className="weekly-action-builder"><label className="toggle-field"><input type="checkbox" checked={addNextAction} onChange={(event) => setAddNextAction(event.target.checked)} /><span>把下一步加入下周行动</span></label>{addNextAction && <><small>行动标题使用上方的“下一步”内容；请定义完成标准。排期可稍后补充。</small><label className="field"><span>完成标准</span><textarea rows={2} value={nextActionDoneWhen} onChange={(event) => setNextActionDoneWhen(event.target.value)} placeholder="结束时我会看到什么结果？" required /></label><label className="field"><span>专注时间（可选）</span><input type="datetime-local" value={nextActionScheduledAt} onChange={(event) => setNextActionScheduledAt(event.target.value)} /></label></>}</section>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>稍后</button><button type="submit" className="button button-primary">保存回顾</button></div></form></ModalFrame>
}

function IntegrationModal({ state, onClose, onReset, onExportCalendar, onEnableNotifications, onReminderChange }: { state: MonitorState; onClose: () => void; onReset: () => void; onExportCalendar: () => void; onEnableNotifications: () => void; onReminderChange: <K extends keyof MonitorState['reminders']>(key: K, value: MonitorState['reminders'][K]) => void }) {
  const scheduledCount = state.goalSpaces.reduce((count, workspace) => count + workspace.tasks.filter((task) => task.scheduledAt && task.status !== 'skipped').length, 0)
  function exportData() {
    const file = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = href
    link.download = 'northstar-goal-monitor-backup.json'
    link.click()
    URL.revokeObjectURL(href)
  }
  return <ModalFrame title="连接与数据来源" subtitle="日历导出和本机提醒可用；尚未连接外部账户或硬件。" onClose={onClose}><div className="integration-list"><IntegrationRow icon={<CalendarDays size={17} />} name="日历" detail="导出所有目标的 .ics 文件后由你手动导入" status="手动导出" /><IntegrationRow icon={<FolderKanban size={17} />} name="GitHub / 项目板" detail="成果证据需要手动确认" status="未连接" /><IntegrationRow icon={<Sparkles size={17} />} name="AI 服务" detail="建议使用本地演示规则生成" status="未连接" /></div><section className="reminder-settings"><div className="settings-heading"><b>本机提醒</b><small>仅在此应用页面运行时检查提醒</small></div><label className="toggle-field"><input type="checkbox" checked={state.reminders.enabled} onChange={(event) => onReminderChange('enabled', event.target.checked)} /><span>启用应用内提醒</span></label><div className="schedule-fields"><label className="field"><span>日终回顾</span><input type="time" value={state.reminders.dailyReviewTime} onChange={(event) => onReminderChange('dailyReviewTime', event.target.value)} /></label><label className="field"><span>提前提醒（分钟）</span><input type="number" min="0" max="60" value={state.reminders.focusLeadMinutes} onChange={(event) => onReminderChange('focusLeadMinutes', Number(event.target.value))} /></label></div><div className="schedule-fields"><label className="field"><span>每周复盘星期</span><select value={state.reminders.weeklyReviewDay} onChange={(event) => onReminderChange('weeklyReviewDay', Number(event.target.value))}>{['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label><label className="field"><span>每周复盘时间</span><input type="time" value={state.reminders.weeklyReviewTime} onChange={(event) => onReminderChange('weeklyReviewTime', event.target.value)} /></label></div><button className="button button-quiet" onClick={onEnableNotifications}>启用 / 检查系统通知权限</button><small className="settings-note">只有点击此按钮才会请求浏览器通知权限。拒绝后仍会显示应用内提醒。</small></section><div className="calendar-export"><div><b>日历文件</b><small>{scheduledCount ? `所有目标已安排 ${scheduledCount} 项专注块` : '先为行动安排日期和时间'}</small></div><button className="button button-quiet" disabled={!scheduledCount} onClick={onExportCalendar}><CalendarDays size={14} />导出 .ics</button><small>单向导出所有目标的排期，不会写入或同步你的日历账户。</small></div><div className="privacy-note"><CheckCircle2 size={15} /><span><b>本机存储</b> · 当前目标、任务、提醒偏好与复盘保存在此浏览器的 localStorage。清理浏览器数据会移除记录。</span></div><div className="data-actions"><button className="button button-quiet" onClick={exportData}><Download size={14} />导出备份 JSON</button><button className="reset-link" onClick={() => { if (window.confirm('将当前浏览器中的目标和复盘替换为演示数据？')) onReset() }}>恢复演示数据</button></div><div className="modal-actions"><button className="button button-primary" onClick={onClose}>明白了</button></div></ModalFrame>
}

function IntegrationRow({ icon, name, detail, status }: { icon: React.ReactNode; name: string; detail: string; status: string }) {
  return <div className="integration-row"><span className="integration-icon">{icon}</span><span className="integration-copy"><b>{name}</b><small>{detail}</small></span><span className="integration-status"><i />{status}</span></div>
}

function ModalFrame({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><span className="modal-eyebrow">NORTHSTAR · GOAL MONITOR</span><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={18} /></button></div>{children}</section></div>
}

export default App
