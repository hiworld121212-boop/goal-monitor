/**
 * Isolated RFC 5545 iCalendar (.ics) generator for Goal Monitor.
 * Pure function module for exporting calendar items.
 */

export interface CalendarExportItem {
  /** Stable identifier for the task or calendar item */
  id: string
  /** Event title / summary */
  title: string
  /**
   * Local scheduled start time as an ISO string (e.g. "2026-11-20T18:30:00",
   * "2026-11-20T18:30", "2026-11-20 18:30") or Date object.
   */
  scheduledStart: string | Date
  /** Duration in minutes */
  durationMinutes: number
  /** Optional event description or notes */
  description?: string
  /** Optional task / event status (e.g. "CONFIRMED", "TENTATIVE") */
  status?: string
  /** Optional alias for scheduledStart */
  start?: string | Date
  /** Optional alias for durationMinutes */
  duration?: number
}

export interface CalendarExportOptions {
  /** Product identifier for PRODID header. Defaults to "-//Goal Monitor//Goal Monitor Calendar//EN" */
  prodId?: string
  /** Calendar name for X-WR-CALNAME property */
  calendarName?: string
  /**
   * Fixed timestamp for DTSTAMP property (Date or ISO string).
   * Useful for deterministic testing or reproducible exports.
   * If omitted, current time is used.
   */
  now?: Date | string
  /** Domain suffix for deterministic UID generation. Defaults to "goal-monitor". */
  uidDomain?: string
  /**
   * Timezone offset in minutes (e.g. +480 for UTC+8, +660 for UTC+11).
   * If provided and scheduledStart does not have an explicit timezone offset,
   * the local ISO components are interpreted using this offset.
   * If omitted, the runtime's local timezone is used.
   */
  timeZoneOffsetMinutes?: number
}

const RFC5545_MAX_LINE_OCTETS = 75

/**
 * Escapes text values according to RFC 5545 Section 3.3.11:
 * - Backslash (\) -> \\
 * - Semicolon (;) -> \;
 * - Comma (,) -> \,
 * - CRLF, CR, LF -> \n
 */
export function escapeIcsText(text: string): string {
  if (!text) {
    return ''
  }
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Folds a single content line at maxBytes UTF-8 octets (default 75) according to RFC 5545 Section 3.1.
 * Continuation lines are prefixed with a single space.
 * Unicode code points (including multi-byte Chinese characters and 4-byte astral plane emojis)
 * are never split across line breaks.
 */
export function foldLine(line: string, maxBytes: number = RFC5545_MAX_LINE_OCTETS): string[] {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= maxBytes) {
    return [line]
  }

  const lines: string[] = []
  let currentLine = ''
  let currentBytes = 0
  let isFirstLine = true

  // Iterating with for...of guarantees code point iteration (never splits surrogate pairs)
  for (const char of line) {
    const charBytes = encoder.encode(char).length
    const lineLimit = isFirstLine ? maxBytes : maxBytes - 1 // 1 byte reserved for continuation space prefix

    if (currentBytes + charBytes > lineLimit && currentLine.length > 0) {
      lines.push(isFirstLine ? currentLine : ' ' + currentLine)
      currentLine = char
      currentBytes = charBytes
      isFirstLine = false
    } else {
      currentLine += char
      currentBytes += charBytes
    }
  }

  if (currentLine.length > 0) {
    lines.push(isFirstLine ? currentLine : ' ' + currentLine)
  }

  return lines
}

/**
 * Formats a Date object into UTC datetime format required by RFC 5545:
 * YYYYMMDDTHHMMSSZ
 */
export function formatUtcDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  const hours = pad(date.getUTCHours())
  const minutes = pad(date.getUTCMinutes())
  const seconds = pad(date.getUTCSeconds())
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Parses a local ISO datetime string (or Date object) into a Date instance.
 * Supports:
 * - "YYYY-MM-DDTHH:mm:ss"
 * - "YYYY-MM-DDTHH:mm"
 * - "YYYY-MM-DD HH:mm:ss"
 * - "YYYY-MM-DD"
 * - Strings with explicit offset/Z (e.g. "2026-11-20T18:30:00+08:00")
 * - Date instances
 */
export function parseLocalIsoDateTime(
  input: string | Date,
  options?: { timeZoneOffsetMinutes?: number }
): Date {
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new Error('Invalid Date object provided to parseLocalIsoDateTime')
    }
    return new Date(input.getTime())
  }

  if (typeof input !== 'string') {
    throw new Error(`Expected date string or Date, received: ${typeof input}`)
  }

  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Empty datetime string provided to parseLocalIsoDateTime')
  }

  // Check if string matches local ISO format without timezone offset or Z
  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/
  )

  if (localMatch) {
    const year = parseInt(localMatch[1], 10)
    const month = parseInt(localMatch[2], 10) - 1
    const day = parseInt(localMatch[3], 10)
    const hour = localMatch[4] ? parseInt(localMatch[4], 10) : 0
    const minute = localMatch[5] ? parseInt(localMatch[5], 10) : 0
    const second = localMatch[6] ? parseInt(localMatch[6], 10) : 0
    const ms = localMatch[7] ? parseInt(localMatch[7].padEnd(3, '0').slice(0, 3), 10) : 0

    if (options?.timeZoneOffsetMinutes !== undefined) {
      const utcMs = Date.UTC(year, month, day, hour, minute, second, ms) - options.timeZoneOffsetMinutes * 60 * 1000
      return new Date(utcMs)
    }

    const localDate = new Date(year, month, day, hour, minute, second, ms)
    if (isNaN(localDate.getTime())) {
      throw new Error(`Invalid local ISO datetime values: "${input}"`)
    }
    return localDate
  }

  // If the string includes timezone offset or Z
  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) {
    throw new Error(`Unable to parse datetime string: "${input}"`)
  }
  return parsed
}

/**
 * Generates a deterministic UID for a given item ID.
 * Returns `${sanitizedId}@${domain}`. If the id already contains '@', it is returned as is.
 */
export function generateDeterministicUid(id: string, domain: string = 'goal-monitor'): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Item id must be a non-empty string')
  }
  const cleanId = id.trim().replace(/\s+/g, '-')
  if (cleanId.includes('@')) {
    return cleanId
  }
  return `${cleanId}@${domain}`
}

/**
 * Pure function that accepts calendar items and returns standards-compatible RFC 5545 .ics text.
 *
 * Requirements met:
 * - RFC 5545 text value escaping (backslash, comma, semicolon, CR/LF)
 * - CRLF line endings (\r\n)
 * - UTC DTSTART/DTEND from local ISO datetime input
 * - Deterministic UID based on stable item id
 * - Fold content lines at 75 UTF-8 octets without splitting Unicode code points
 *
 * @param items Array of calendar items to export
 * @param options Export options (prodId, calendarName, now, uidDomain, timeZoneOffsetMinutes)
 * @returns RFC 5545 compliant .ics string
 */
export function exportCalendarToIcs(
  items: CalendarExportItem[],
  options?: CalendarExportOptions
): string {
  const prodId = options?.prodId || '-//Goal Monitor//Goal Monitor Calendar//EN'
  const domain = options?.uidDomain || 'goal-monitor'

  // Determine DTSTAMP
  let dtstampDate: Date
  if (options?.now) {
    dtstampDate = options.now instanceof Date ? options.now : new Date(options.now)
  } else {
    dtstampDate = new Date()
  }
  const dtstamp = formatUtcDateTime(dtstampDate)

  const logicalLines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  if (options?.calendarName) {
    logicalLines.push(`X-WR-CALNAME:${escapeIcsText(options.calendarName)}`)
  }

  for (const item of items) {
    const rawStart = item.scheduledStart ?? item.start
    if (!rawStart) {
      throw new Error(`Calendar item "${item.id}" is missing scheduledStart`)
    }

    const startDate = parseLocalIsoDateTime(rawStart, {
      timeZoneOffsetMinutes: options?.timeZoneOffsetMinutes,
    })

    const durationMinutes = Math.max(0, Math.round(item.durationMinutes ?? item.duration ?? 0))
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)

    const uid = generateDeterministicUid(item.id, domain)
    const dtstart = formatUtcDateTime(startDate)
    const dtend = formatUtcDateTime(endDate)

    logicalLines.push('BEGIN:VEVENT')
    logicalLines.push(`UID:${uid}`)
    logicalLines.push(`DTSTAMP:${dtstamp}`)
    logicalLines.push(`DTSTART:${dtstart}`)
    logicalLines.push(`DTEND:${dtend}`)
    logicalLines.push(`SUMMARY:${escapeIcsText(item.title ?? '')}`)

    if (item.description !== undefined && item.description !== null) {
      logicalLines.push(`DESCRIPTION:${escapeIcsText(item.description)}`)
    }

    if (item.status) {
      logicalLines.push(`STATUS:${item.status.toUpperCase()}`)
    }

    logicalLines.push('END:VEVENT')
  }

  logicalLines.push('END:VCALENDAR')

  // Fold every content line at 75 UTF-8 octets without splitting Unicode code points
  const physicalLines: string[] = []
  for (const line of logicalLines) {
    physicalLines.push(...foldLine(line, RFC5545_MAX_LINE_OCTETS))
  }

  // Join lines with CRLF and append a trailing CRLF as required by RFC 5545
  return physicalLines.join('\r\n') + '\r\n'
}

// Convenient aliases
export { exportCalendarToIcs as generateIcsCalendar, exportCalendarToIcs as exportIcs }
export default exportCalendarToIcs
