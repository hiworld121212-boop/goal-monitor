import { localDateKey, type OutcomeMetric } from './model'
import { getReviewDateRange, type ReviewWindow } from './feedback'

/** Returns progress from the baseline to target, clamped to 0–100. */
export function metricProgress(metric: Pick<OutcomeMetric, 'baseline' | 'target' | 'current'>): number | null {
  const span = metric.target - metric.baseline
  if (!Number.isFinite(span) || span === 0 || !Number.isFinite(metric.current)) return null
  return Math.round(Math.max(0, Math.min(1, (metric.current - metric.baseline) / span)) * 100)
}

export function isValidMetric(metric: Pick<OutcomeMetric, 'name' | 'unit' | 'baseline' | 'target' | 'current'>): boolean {
  return Boolean(metric.name.trim() && metric.unit.trim())
    && Number.isFinite(metric.baseline)
    && Number.isFinite(metric.target)
    && Number.isFinite(metric.current)
    && metric.target !== metric.baseline
}

export function metricTrendCoordinates(values: number[]) {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values.map((value, index) => ({
    x: values.length === 1 ? 120 : 8 + (index / (values.length - 1)) * 224,
    y: 52 - ((value - min) / span) * 44,
    value,
  }))
}

export function buildMetricReviewContext(metrics: OutcomeMetric[], window: ReviewWindow, now = new Date()) {
  const { startDate, endDate } = getReviewDateRange(window, now)
  return metrics.map((metric) => {
    const snapshots = (metric.history || [])
      .map((snapshot) => ({ ...snapshot, timestamp: Date.parse(snapshot.recordedAt) }))
      .filter((snapshot) => Number.isFinite(snapshot.timestamp) && Number.isFinite(snapshot.value))
      .sort((a, b) => a.timestamp - b.timestamp)
    const inWindow = snapshots.filter((snapshot) => {
      const date = localDateKey(new Date(snapshot.timestamp))
      return date >= startDate && date <= endDate
    })
    const priorSnapshots = inWindow.length > 0
      ? snapshots.filter((snapshot) => snapshot.timestamp < inWindow[0].timestamp)
      : undefined
    const previousSnapshot = priorSnapshots?.[priorSnapshots.length - 1]
    const firstValue = previousSnapshot?.value ?? (inWindow.length > 1 ? inWindow[0].value : undefined)
    const latestValue = inWindow.length > 0 ? inWindow[inWindow.length - 1].value : undefined
    const delta = firstValue !== undefined && latestValue !== undefined && inWindow.length > 0
      ? latestValue - firstValue
      : undefined
    return {
      id: metric.id,
      name: metric.name,
      unit: metric.unit,
      current: metric.current,
      updatedAt: metric.updatedAt,
      startDate,
      endDate,
      recordedCount: inWindow.length,
      firstValue,
      latestValue,
      delta,
      observation: inWindow.length === 0
        ? `本区间没有新增记录；当前值 ${metric.current} ${metric.unit}，最后记录于 ${metric.updatedAt}。`
        : delta === undefined
          ? `本区间记录 ${inWindow.length} 次，最近值 ${latestValue} ${metric.unit}；缺少区间前基准，无法计算变化。`
          : `本区间记录 ${inWindow.length} 次：${firstValue} → ${latestValue} ${metric.unit}（变化 ${delta > 0 ? '+' : ''}${delta}）。`,
    }
  })
}
