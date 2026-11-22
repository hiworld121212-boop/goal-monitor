import { describe, expect, it } from 'vitest'
import { changeTaskStatus, completedCount, demoState, localDateKey, loadState, storageKey, syncActiveGoalWorkspace } from './model'

describe('task evidence state', () => {
  it('does not count planned time as confirmed output', () => {
    expect(completedCount(demoState.tasks)).toBe(0)
    expect(demoState.tasks.every((task) => task.status === 'planned')).toBe(true)
  })

  it('counts only explicitly confirmed tasks as output', () => {
    const tasks = changeTaskStatus(demoState.tasks, 'a1', 'confirmed')
    expect(completedCount(tasks)).toBe(1)
    expect(tasks.find((task) => task.id === 'a1')?.status).toBe('confirmed')
  })

  it('keeps missing evidence as pending rather than failure', () => {
    const tasks = changeTaskStatus(demoState.tasks, 'a1', 'pending')
    expect(completedCount(tasks)).toBe(0)
    expect(tasks.find((task) => task.id === 'a1')?.status).toBe('pending')
  })

  it('formats review dates from local calendar fields instead of UTC dates', () => {
    const localMidnight = new Date(2026, 10, 20, 0, 5)
    expect(localDateKey(localMidnight)).toBe('2026-11-20')
  })

  it('loads older saved goals without outcome metrics', () => {
    localStorage.setItem(storageKey, JSON.stringify({ goal: { direction: '旧版目标' } }))
    expect(loadState().goal.direction).toBe('旧版目标')
    expect(loadState().goal.outcomeMetrics).toEqual([])
    expect(loadState().weeklyFocusBudgetMinutes).toBe(0)
  })

  it('migrates existing outcome metrics that have no history', () => {
    localStorage.setItem(storageKey, JSON.stringify({ goal: { outcomeMetrics: [{ id: 'salary', name: 'Salary', unit: 'AUD', direction: 'increase', baseline: 10, target: 20, current: 15, updatedAt: '2026-11-20' }] } }))
    expect(loadState().goal.outcomeMetrics[0].history).toEqual([])
  })

  it('migrates and bounds the optional weekly focus budget', () => {
    localStorage.setItem(storageKey, JSON.stringify({ ...demoState, weeklyFocusBudgetMinutes: 3600 }))
    expect(loadState().weeklyFocusBudgetMinutes).toBe(3000)
    localStorage.setItem(storageKey, JSON.stringify({ ...demoState, weeklyFocusBudgetMinutes: -30 }))
    expect(loadState().weeklyFocusBudgetMinutes).toBe(0)
  })

  it('migrates a single-goal saved state into an isolated workspace', () => {
    localStorage.setItem(storageKey, JSON.stringify({ goal: { direction: '旧目标方向' }, tasks: [taskFixture()] }))
    const state = loadState()
    expect(state.activeGoalSpaceId).toBe('career-finance')
    expect(state.goalSpaces).toHaveLength(1)
    expect(state.goalSpaces[0].goal.direction).toBe('旧目标方向')
    expect(state.goalSpaces[0].tasks[0].title).toBe('Legacy action')
  })

  it('loads the selected workspace as the active goal, tasks and reviews', () => {
    const second = { ...demoState.goalSpaces[0], id: 'health', name: '健康', goal: { ...demoState.goal, direction: '保持健康' }, tasks: [], dayReviews: [{ date: '2026-11-20', result: '走路', obstacle: '', nextStep: '' }] }
    localStorage.setItem(storageKey, JSON.stringify({ ...demoState, goalSpaces: [...demoState.goalSpaces, second], activeGoalSpaceId: 'health' }))
    const state = loadState()
    expect(state.goal.direction).toBe('保持健康')
    expect(state.tasks).toEqual([])
    expect(state.dayReviews[0].result).toBe('走路')
  })

  it('syncs edits only to the selected workspace and preserves others', () => {
    const state = syncActiveGoalWorkspace({ ...demoState, goalSpaces: [...demoState.goalSpaces, { ...demoState.goalSpaces[0], id: 'health', name: '健康', goal: { ...demoState.goal, direction: '健康方向' }, tasks: [] }] })
    const changed = syncActiveGoalWorkspace({ ...state, goal: { ...state.goal, direction: '新职业方向' } })
    expect(changed.goalSpaces.find((workspace) => workspace.id === 'career-finance')?.goal.direction).toBe('新职业方向')
    expect(changed.goalSpaces.find((workspace) => workspace.id === 'health')?.goal.direction).toBe('健康方向')
  })
})

function taskFixture() {
  return { id: 'legacy-task', title: 'Legacy action', time: '', duration: 30, doneWhen: 'done', evidence: '', status: 'planned', kind: 'build' }
}
