import { describe, expect, it } from 'vitest'
import { buildMetricReviewContext, isValidMetric, metricProgress, metricTrendCoordinates } from './metrics'
import type { OutcomeMetric } from './model'

const metric = (history: OutcomeMetric['history'], overrides: Partial<OutcomeMetric> = {}): OutcomeMetric => ({
  id: 'salary', name: '薪资', unit: 'AUD', direction: 'increase', baseline: 100, target: 200, current: 150,
  updatedAt: '2026-11-27', history, ...overrides,
})

describe('outcome metric progress', () => {
  it('calculates upward progress from the baseline toward the target', () => {
    expect(metricProgress({ baseline: 100, current: 125, target: 200 })).toBe(25)
  })

  it('calculates downward targets such as reducing debt', () => {
    expect(metricProgress({ baseline: 1000, current: 700, target: 400 })).toBe(50)
  })

  it('clamps values below baseline or beyond target', () => {
    expect(metricProgress({ baseline: 10, current: 5, target: 20 })).toBe(0)
    expect(metricProgress({ baseline: 10, current: 25, target: 20 })).toBe(100)
  })

  it('returns no percentage for an unchanged target or invalid current value', () => {
    expect(metricProgress({ baseline: 10, current: 11, target: 10 })).toBeNull()
    expect(metricProgress({ baseline: 10, current: Number.NaN, target: 20 })).toBeNull()
  })

  it('validates names, units and distinct finite baseline and target values', () => {
    expect(isValidMetric({ name: 'Annual salary', unit: 'AUD/year', baseline: 100, current: 120, target: 200 })).toBe(true)
    expect(isValidMetric({ name: ' ', unit: 'AUD', baseline: 100, current: 120, target: 200 })).toBe(false)
    expect(isValidMetric({ name: 'Annual salary', unit: 'AUD/year', baseline: 100, current: 120, target: 100 })).toBe(false)
  })

  it('maps historical values to ordered chart coordinates with a stable single-point position', () => {
    expect(metricTrendCoordinates([10, 20, 15])).toEqual([
      { x: 8, y: 52, value: 10 },
      { x: 120, y: 8, value: 20 },
      { x: 232, y: 30, value: 15 },
    ])
    expect(metricTrendCoordinates([7])).toEqual([{ x: 120, y: 52, value: 7 }])
    expect(metricTrendCoordinates([7, Number.NaN])).toEqual([])
  })

  it('summarizes metric changes recorded within the selected local review window', () => {
    const result = buildMetricReviewContext([metric([
      { recordedAt: '2026-11-22T12:00:00+11:00', value: 10 },
      { recordedAt: '2026-11-24T12:00:00+11:00', value: 12 },
      { recordedAt: '2026-11-27T12:00:00+11:00', value: 15 },
      { recordedAt: '2026-11-30T12:00:00+11:00', value: 19 },
    ])], 'week', new Date(2026, 10, 29, 12))
    expect(result[0]).toMatchObject({ recordedCount: 2, firstValue: 10, latestValue: 15, delta: 5, startDate: '2026-11-23', endDate: '2026-11-29' })
    expect(result[0].observation).toContain('变化 +5')
  })

  it('shows no new record without inferring a negative result', () => {
    const result = buildMetricReviewContext([metric([], { current: 150, updatedAt: '2026-11-20' })], 'week', new Date(2026, 10, 29, 12))
    expect(result[0].recordedCount).toBe(0)
    expect(result[0].observation).toContain('本区间没有新增记录')
    expect(result[0].observation).toContain('当前值 150 AUD')
  })

  it('does not invent a change when only the first snapshot exists in a period', () => {
    const result = buildMetricReviewContext([metric([{ recordedAt: '2026-11-24T12:00:00+11:00', value: 120 }])], 'week', new Date(2026, 10, 29, 12))
    expect(result[0].delta).toBeUndefined()
    expect(result[0].observation).toContain('缺少区间前基准')
  })
})
