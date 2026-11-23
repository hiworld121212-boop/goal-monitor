import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { demoState, storageKey, syncActiveGoalWorkspace } from './model'

describe('Goal Monitor first-run flows', () => {
  beforeEach(() => localStorage.clear())

  it('shows the direction and separates scheduled work from confirmed evidence', () => {
    render(<App />)
    expect(screen.getByText(/提高数据工程与 AI 系统方面的职业收入/)).toBeInTheDocument()
    expect(screen.getByText('计划投入')).toBeInTheDocument()
    expect(screen.getByText('实际产出')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '今日与本周行动' })).toBeInTheDocument()
    expect(screen.getByText('0 / 3')).toBeInTheDocument()
    expect(screen.getByText('今天还没有安排专注块')).toBeInTheDocument()
    expect(screen.getByText('建议下一步')).toBeInTheDocument()
  })

  it('lets the progress feedback start its suggested task and preserves confirmed outcome counts', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '开始这项行动' }))
    expect(screen.getByRole('heading', { name: /做一个展示目标岗位核心技能/ })).toBeInTheDocument()
    expect(screen.getByText('进行中')).toBeInTheDocument()
  })

  it('requires an explicit user action to confirm a task', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /确认比较两份目标岗位描述/ }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(within(screen.getAllByRole('article')[0]).getByText('已确认')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(storageKey) || '{}').tasks[0].status).toBe('confirmed')
  })

  it('allows adding an action with a concrete done condition', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /添加任务/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText('例如：跑通一个数据质量检查'), { target: { value: '运行第一条数据检查' } })
    fireEvent.change(within(dialog).getByPlaceholderText('结束时我会看到什么结果？'), { target: { value: '看到一份检查结果' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '添加行动' }))
    expect(screen.getByText('运行第一条数据检查')).toBeInTheDocument()
  })

  it('saves a daily review and shows it in review history', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /开始日终回顾/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText(/完成了岗位技能对比/), { target: { value: '选定一个案例技能' } })
    fireEvent.change(within(dialog).getByPlaceholderText(/明天先跑通/), { target: { value: '明天验证一个例子' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存回顾' }))
    fireEvent.click(screen.getByRole('button', { name: /复盘记录/ }))
    expect(await screen.findByText(/选定一个案例技能/)).toBeInTheDocument()
    expect(await screen.findByText(/明天验证一个例子/)).toBeInTheDocument()
  })

  it('shows an evidence-based review summary without treating unscheduled work as failure', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /开始日终回顾/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/自动汇总 · 当前任务状态/)).toBeInTheDocument()
    expect(within(dialog).getByText(/另有 3 项行动没有排期/)).toBeInTheDocument()
    expect(within(dialog).getByText(/不代表没有做事/)).toBeInTheDocument()
  })

  it('supports a weekly decision and records the selected adjustment', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /复盘记录/ }))
    fireEvent.click(screen.getByRole('button', { name: /每周复盘/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/自动汇总 · 当前任务状态/)).toBeInTheDocument()
    expect(within(dialog).getByText(/另有 3 项行动没有排期/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '缩小' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '保存回顾' }))
    expect(screen.getByText(/缩小任务范围/)).toBeInTheDocument()
  })

  it('turns an explicitly selected weekly next step into a scheduled planned action', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /复盘记录/ }))
    fireEvent.click(screen.getByRole('button', { name: /每周复盘/ }))
    const dialog = screen.getByRole('dialog', { name: '每周复盘' })
    fireEvent.change(within(dialog).getByPlaceholderText(/明天先跑通/), { target: { value: '整理三份岗位技能对照' } })
    fireEvent.click(within(dialog).getByLabelText('把下一步加入下周行动'))
    fireEvent.change(within(dialog).getByPlaceholderText('结束时我会看到什么结果？'), { target: { value: '保存三份链接和一张技能对照表' } })
    fireEvent.change(within(dialog).getByLabelText('专注时间（可选）'), { target: { value: '2026-11-23T18:30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存回顾' }))
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
    expect(stored.weekReviews).toHaveLength(1)
    expect(stored.tasks).toHaveLength(4)
    expect(stored.tasks[3]).toMatchObject({ title: '整理三份岗位技能对照', doneWhen: '保存三份链接和一张技能对照表', status: 'planned', scheduledAt: '2026-11-23T18:30' })
    expect(stored.tasks.filter((task: { status: string }) => task.status === 'confirmed')).toHaveLength(0)
  })

  it('lets the user edit and save their long-term direction', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '编辑方向' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByDisplayValue(/提高数据工程与 AI 系统方面/), { target: { value: '五年内成为能独立交付 AI 数据产品的工程师。' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存方向' }))
    expect(screen.getByText('五年内成为能独立交付 AI 数据产品的工程师。')).toBeInTheDocument()
  })

  it('creates and updates a financial outcome metric separately from action completion', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '编辑方向' }))
    const editor = screen.getByRole('dialog')
    fireEvent.change(within(editor).getByPlaceholderText('例如：年薪、月储蓄、面试数'), { target: { value: '年薪' } })
    fireEvent.change(within(editor).getByLabelText('单位'), { target: { value: 'AUD / year' } })
    fireEvent.change(within(editor).getByLabelText('起始基线'), { target: { value: '80000' } })
    fireEvent.change(within(editor).getByLabelText('目标值'), { target: { value: '150000' } })
    fireEvent.change(within(editor).getByLabelText('当前值'), { target: { value: '100000' } })
    fireEvent.click(within(editor).getByRole('button', { name: '添加结果指标' }))
    fireEvent.click(within(editor).getByRole('button', { name: '保存方向' }))
    expect(screen.getByText('从基线到目标 29%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '更新当前值' }))
    const update = screen.getByRole('dialog', { name: '更新年薪' })
    fireEvent.change(within(update).getByLabelText('当前值（AUD / year）'), { target: { value: '125000' } })
    fireEvent.change(within(update).getByPlaceholderText('例如：工资单、月底预算记录'), { target: { value: '工资单' } })
    fireEvent.click(within(update).getByRole('button', { name: '保存当前值' }))
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
    expect(stored.goal.outcomeMetrics[0].current).toBe(125000)
    expect(stored.goal.outcomeMetrics[0].evidenceNote).toBe('工资单')
    expect(stored.goal.outcomeMetrics[0].history).toHaveLength(2)
    expect(stored.goal.outcomeMetrics[0].history[1]).toMatchObject({ value: 125000, evidenceNote: '工资单' })
    expect(screen.getByText('从基线到目标 64%')).toBeInTheDocument()
    expect(screen.getByText('2 次记录')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '年薪历史值与基线、目标对比' })).toBeInTheDocument()
    expect(screen.getByText('0 / 3')).toBeInTheDocument()
  })

  it('includes time-bounded outcome signal context in the weekly review without causal claims', () => {
    const now = Date.now()
    localStorage.setItem(storageKey, JSON.stringify(syncActiveGoalWorkspace({
      ...demoState,
      goal: { ...demoState.goal, outcomeMetrics: [{ id: 'salary', name: '年薪', unit: 'AUD/year', direction: 'increase', baseline: 80000, target: 150000, current: 120000, updatedAt: new Date(now).toISOString().slice(0, 10), history: [
        { recordedAt: new Date(now - 60_000).toISOString(), value: 110000 },
        { recordedAt: new Date(now).toISOString(), value: 120000 },
      ] }] },
    })))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /每周复盘/ }))
    const review = screen.getByRole('dialog', { name: '每周复盘' })
    expect(within(review).getByRole('region', { name: '区间结果指标' })).toBeInTheDocument()
    expect(within(review).getByText(/变化 \+10000/)).toBeInTheDocument()
    expect(within(review).getByText('同一时期出现的变化不代表行动造成了结果。')).toBeInTheDocument()
  })

  it('creates and switches between isolated goals, actions and saved workspace data', () => {
    const app = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '添加目标' }))
    const create = screen.getByRole('dialog', { name: '添加一个目标' })
    fireEvent.change(within(create).getByPlaceholderText('例如：职业发展、财务安全、家庭'), { target: { value: '健康' } })
    fireEvent.change(within(create).getByPlaceholderText('五年后希望什么变得不一样？'), { target: { value: '五年后精力充沛并保持健康习惯。' } })
    fireEvent.click(within(create).getByRole('button', { name: '创建目标' }))
    expect(screen.getByText('五年后精力充沛并保持健康习惯。')).toBeInTheDocument()
    expect(screen.getByText('当前没有待推进的行动')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '添加任务' }))
    const taskEditor = screen.getByRole('dialog', { name: '添加杠杆行动' })
    fireEvent.change(within(taskEditor).getByPlaceholderText('例如：跑通一个数据质量检查'), { target: { value: '午休散步' } })
    fireEvent.change(within(taskEditor).getByPlaceholderText('结束时我会看到什么结果？'), { target: { value: '走路 10 分钟' } })
    fireEvent.click(within(taskEditor).getByRole('button', { name: '添加行动' }))
    expect(screen.getAllByText('午休散步').length).toBeGreaterThan(0)

    const selector = screen.getByLabelText('切换目标') as HTMLSelectElement
    fireEvent.change(selector, { target: { value: 'career-finance' } })
    expect(screen.getByText(/提高数据工程与 AI 系统方面的职业收入/)).toBeInTheDocument()
    expect(screen.getAllByText(/比较两份目标岗位描述/).length).toBeGreaterThan(0)
    fireEvent.change(selector, { target: { value: selector.options[1].value } })
    expect(screen.getAllByText('午休散步').length).toBeGreaterThan(0)

    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
    expect(stored.goalSpaces).toHaveLength(2)
    expect(stored.goalSpaces.find((space: { name: string }) => space.name === '健康').tasks[0].title).toBe('午休散步')
    app.unmount()
    render(<App />)
    expect(screen.getAllByText('午休散步').length).toBeGreaterThan(0)
    expect(screen.getByText('五年后精力充沛并保持健康习惯。')).toBeInTheDocument()
  })

  it('shows a combined weekly calendar agenda and opens the owning goal', () => {
    const now = new Date()
    const scheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30).toISOString()
    const career = { ...demoState.goalSpaces[0], tasks: [{ ...demoState.tasks[0], scheduledAt }] }
    const health = { ...demoState.goalSpaces[0], id: 'health', name: '健康', goal: { ...demoState.goal, project: '健康项目' }, tasks: [{ ...demoState.tasks[0], id: 'walk', title: '午休散步', scheduledAt }] }
    localStorage.setItem(storageKey, JSON.stringify(syncActiveGoalWorkspace({ ...demoState, goalSpaces: [career, health] })))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '日历' }))
    expect(screen.getByText('ALL GOALS · WEEKLY AGENDA')).toBeInTheDocument()
    expect(screen.getAllByText('职业与财务').length).toBeGreaterThan(0)
    expect(screen.getAllByText('健康').length).toBeGreaterThan(0)
    expect(screen.getByText('午休散步')).toBeInTheDocument()
    fireEvent.click(within(screen.getByText('午休散步').closest('.agenda-item')!).getByRole('button', { name: '查看目标' }))
    expect((screen.getByLabelText('切换目标') as HTMLSelectElement).value).toBe('health')
    expect(screen.getByRole('heading', { name: '健康项目' })).toBeInTheDocument()
  })

  it('updates the owning goal from the calendar and records explicit completion evidence', () => {
    const now = new Date()
    const scheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30).toISOString()
    const career = { ...demoState.goalSpaces[0], tasks: [{ ...demoState.tasks[0], scheduledAt }] }
    const health = { ...demoState.goalSpaces[0], id: 'health', name: '健康', goal: { ...demoState.goal, project: '健康项目' }, tasks: [{ ...demoState.tasks[0], id: 'walk', title: '午休散步', scheduledAt, status: 'planned' as const }] }
    localStorage.setItem(storageKey, JSON.stringify(syncActiveGoalWorkspace({ ...demoState, goalSpaces: [career, health] })))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '日历' }))
    const item = screen.getByText('午休散步').closest('.agenda-item') as HTMLElement
    fireEvent.click(within(item).getByRole('button', { name: '开始' }))
    expect(within(item).getByText(/进行中/)).toBeInTheDocument()
    vi.spyOn(window, 'prompt').mockReturnValue('本地运行结果已保存')
    fireEvent.click(within(item).getByRole('button', { name: '确认完成' }))
    expect(within(item).getByText(/已确认/)).toBeInTheDocument()
    expect(within(item).getByText('完成记录：本地运行结果已保存')).toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
    expect(stored.goalSpaces.find((space: { id: string }) => space.id === 'health').tasks[0]).toMatchObject({ status: 'confirmed', evidenceNote: '本地运行结果已保存' })
    expect(stored.goalSpaces.find((space: { id: string }) => space.id === 'career-finance').tasks[0].status).toBe('planned')
  })

  it('keeps skipped scheduled actions in the agenda so they can be restored', () => {
    const now = new Date()
    const scheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30).toISOString()
    const skippedTask = { ...demoState.tasks[0], id: 'recoverable', title: '可恢复行动', scheduledAt }
    const career = { ...demoState.goalSpaces[0], tasks: [skippedTask] }
    localStorage.setItem(storageKey, JSON.stringify(syncActiveGoalWorkspace({ ...demoState, tasks: [skippedTask], goalSpaces: [career] })))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '日历' }))
    let item = screen.getByText('可恢复行动').closest('.agenda-item') as HTMLElement
    fireEvent.click(within(item).getByRole('button', { name: '跳过' }))
    item = screen.getByText('可恢复行动').closest('.agenda-item') as HTMLElement
    expect(within(item).getByText(/已跳过/)).toBeInTheDocument()
    fireEvent.click(within(item).getByRole('button', { name: '恢复' }))
    item = screen.getByText('可恢复行动').closest('.agenda-item') as HTMLElement
    expect(within(item).getByText(/计划中/)).toBeInTheDocument()
  })

  it('shows today actions from other goals and writes progress only to that workspace', () => {
    const now = new Date()
    const scheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30).toISOString()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 30).toISOString()
    const health = { ...demoState.goalSpaces[0], id: 'health', name: '健康', goal: { ...demoState.goal, project: '健康项目' }, tasks: [
      { ...demoState.tasks[0], id: 'walk', title: '午休散步', scheduledAt, status: 'planned' as const },
      { ...demoState.tasks[1], id: 'old', title: '昨天行动', scheduledAt: yesterday, status: 'planned' as const },
    ] }
    localStorage.setItem(storageKey, JSON.stringify(syncActiveGoalWorkspace({ ...demoState, goalSpaces: [demoState.goalSpaces[0], health] })))
    render(<App />)
    const summary = screen.getByRole('region', { name: '其他目标的今日行动' })
    expect(within(summary).getByText('午休散步')).toBeInTheDocument()
    expect(within(summary).queryByText('昨天行动')).not.toBeInTheDocument()
    fireEvent.click(within(summary).getByRole('button', { name: '开始' }))
    expect(within(summary).getByText(/进行中/)).toBeInTheDocument()
    vi.spyOn(window, 'prompt').mockReturnValue('步数记录已保存')
    fireEvent.click(within(summary).getByRole('button', { name: '确认完成' }))
    expect(within(summary).getByText('完成记录：步数记录已保存')).toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
    expect(stored.goalSpaces.find((space: { id: string }) => space.id === 'health').tasks[0]).toMatchObject({ status: 'confirmed', evidenceNote: '步数记录已保存' })
    expect(stored.goalSpaces.find((space: { id: string }) => space.id === 'career-finance').tasks[0].status).toBe('planned')
  })

  it('compares all goal schedules with a user-set weekly focus budget', () => {
    const now = new Date()
    const scheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30).toISOString()
    const tasks = [{ ...demoState.tasks[0], scheduledAt, duration: 60 }]
    const active = { ...demoState.goalSpaces[0], tasks }
    localStorage.setItem(storageKey, JSON.stringify(syncActiveGoalWorkspace({ ...demoState, tasks, goalSpaces: [active], weeklyFocusBudgetMinutes: 45 })))
    render(<App />)
    expect(screen.getByText('60 分钟')).toBeInTheDocument()
    expect(screen.getByText('超出预算 15 分钟')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('每周可投入分钟'), { target: { value: '120' } })
    expect(screen.getByText('每周预算剩余 60 分钟')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(storageKey) || '{}').weeklyFocusBudgetMinutes).toBe(120)
    expect(screen.getByText('0 / 1')).toBeInTheDocument()
  })

  it('labels calendar, evidence, and AI connections as unconnected in the local MVP', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '连接与隐私' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('日历')).toBeInTheDocument()
    expect(within(dialog).getByText('GitHub / 项目板')).toBeInTheDocument()
    expect(within(dialog).getByText('AI 服务')).toBeInTheDocument()
    expect(within(dialog).getAllByText('未连接')).toHaveLength(2)
    expect(within(dialog).getByText('手动导出')).toBeInTheDocument()
    expect(within(dialog).getByText('本机提醒')).toBeInTheDocument()
  })

  it('saves a scheduled focus block and exposes calendar export', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /安排比较两份目标岗位描述/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('专注时间（可选）'), { target: { value: '2026-11-23T18:30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存行动' }))
    expect(JSON.parse(localStorage.getItem(storageKey) || '{}').tasks[0].scheduledAt).toBe('2026-11-23T18:30')
    fireEvent.click(screen.getByRole('button', { name: '连接与隐私' }))
    expect(screen.getByRole('button', { name: '导出 .ics' })).toBeEnabled()
    expect(screen.getByText(/单向导出所有目标/)).toBeInTheDocument()
  })

  it('allows configuring local reminders without requesting notification permission on render', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '连接与隐私' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('日终回顾'), { target: { value: '21:15' } })
    expect(JSON.parse(localStorage.getItem(storageKey) || '{}').reminders.dailyReviewTime).toBe('21:15')
    expect(JSON.parse(localStorage.getItem(storageKey) || '{}').reminders.notificationPermissionRequested).toBe(false)
  })

  it('closes the mobile drawer using the close button, backdrop, and secondary links', () => {
    render(<App />)
    const sidebar = document.querySelector('.sidebar')!
    fireEvent.click(screen.getByRole('button', { name: '打开导航' }))
    expect(sidebar).toHaveClass('sidebar-open')
    fireEvent.click(document.querySelector('.drawer-close')!)
    expect(sidebar).not.toHaveClass('sidebar-open')

    fireEvent.click(screen.getByRole('button', { name: '打开导航' }))
    fireEvent.click(document.querySelector('.sidebar-backdrop')!)
    expect(sidebar).not.toHaveClass('sidebar-open')

    fireEvent.click(screen.getByRole('button', { name: '打开导航' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(sidebar).not.toHaveClass('sidebar-open')

    fireEvent.click(screen.getByRole('button', { name: '打开导航' }))
    fireEvent.click(screen.getByRole('button', { name: /当前项目/ }))
    expect(sidebar).not.toHaveClass('sidebar-open')
    expect(screen.getByRole('heading', { name: /做一个展示目标岗位核心技能/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开导航' }))
    fireEvent.click(screen.getByRole('button', { name: /U 个人账户 偏好与连接/ }))
    expect(sidebar).not.toHaveClass('sidebar-open')
    expect(screen.getByRole('dialog', { name: '连接与数据来源' })).toBeInTheDocument()
  })

  it('displays simple, clear icon-based progress summaries for daily, weekly, monthly, and yearly slices on the homepage', () => {
    render(<App />)
    const section = screen.getByRole('region', { name: '阶段进展切片总览' })
    expect(section).toBeInTheDocument()
    expect(within(section).getByText('日·周·月·年进度切片')).toBeInTheDocument()

    // Daily & weekly default to no-data without invented percentages
    expect(within(section).getByText('今日无排期')).toBeInTheDocument()
    expect(within(section).getByText('本周无排期')).toBeInTheDocument()

    // Monthly reflects 30-day project actions with honest evidence
    expect(within(section).getByText('0 / 3 项产出已确认')).toBeInTheDocument()
    expect(within(section).getByText('0%')).toBeInTheDocument()

    // Yearly reflects annual milestone with no-data state when metrics are absent
    expect(within(section).getByText('待设定量化指标')).toBeInTheDocument()
    expect(within(section).getByText(/通过晋升或新岗位/)).toBeInTheDocument()
  })

  it('updates daily and weekly slices when tasks are scheduled and evidence is confirmed', () => {
    const now = new Date()
    const scheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0).toISOString()
    const scheduledTask = { ...demoState.tasks[0], scheduledAt, status: 'confirmed' as const, evidenceNote: '已跑通测试' }
    localStorage.setItem(storageKey, JSON.stringify(syncActiveGoalWorkspace({
      ...demoState,
      tasks: [scheduledTask, demoState.tasks[1]],
      goalSpaces: [{ ...demoState.goalSpaces[0], tasks: [scheduledTask, demoState.tasks[1]] }],
    })))
    render(<App />)
    const section = screen.getByRole('region', { name: '阶段进展切片总览' })
    const dailyCard = section.querySelector('.slice-daily') as HTMLElement
    const weeklyCard = section.querySelector('.slice-weekly') as HTMLElement
    const monthlyCard = section.querySelector('.slice-monthly') as HTMLElement

    expect(within(dailyCard).getByText('1 / 1 今日已确认')).toBeInTheDocument()
    expect(within(dailyCard).getByText('100%')).toBeInTheDocument()
    expect(within(weeklyCard).getByText('1 / 1 本周已确认')).toBeInTheDocument()
    expect(within(weeklyCard).getByText('100%')).toBeInTheDocument()
    expect(within(monthlyCard).getByText('1 / 2 项产出已确认')).toBeInTheDocument()
    expect(within(monthlyCard).getByText('50%')).toBeInTheDocument()
  })
})
