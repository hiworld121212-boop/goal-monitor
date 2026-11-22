import { describe, it, expect } from 'vitest'
import {
  exportCalendarToIcs,
  generateIcsCalendar,
  exportIcs,
  escapeIcsText,
  foldLine,
  formatUtcDateTime,
  parseLocalIsoDateTime,
  generateDeterministicUid,
  type CalendarExportItem,
} from './calendarExport'

describe('calendarExport (T50)', () => {
  describe('escapeIcsText', () => {
    it('escapes backslash, semicolon, comma according to RFC 5545', () => {
      const input = 'Path: C:\\Work; Project, Milestone'
      const expected = 'Path: C:\\\\Work\\; Project\\, Milestone'
      expect(escapeIcsText(input)).toBe(expected)
    })

    it('converts CR, LF, and CRLF newlines into literal \\n', () => {
      const input = 'Line 1\r\nLine 2\nLine 3\rLine 4'
      const expected = 'Line 1\\nLine 2\\nLine 3\\nLine 4'
      expect(escapeIcsText(input)).toBe(expected)
    })

    it('preserves Chinese characters and Chinese fullwidth punctuation untouched while escaping ASCII punctuation', () => {
      const input = '【目标】完成数据工程案例；产出：代码, 文档与报告。包含换行：\n- 步骤1：检查;\n- 步骤2：提交,'
      const escaped = escapeIcsText(input)
      // Fullwidth Chinese punctuation untouched
      expect(escaped).toContain('【目标】')
      expect(escaped).toContain('；产出：')
      expect(escaped).toContain('文档与报告。')
      // ASCII comma and semicolon escaped
      expect(escaped).toContain('\\,')
      expect(escaped).toContain('\\;')
      // Newlines turned into \n
      expect(escaped).toContain('\\n- 步骤1：检查\\;')
      expect(escaped).toContain('\\n- 步骤2：提交\\,')
      // No raw unescaped newlines
      expect(escaped).not.toMatch(/[\r\n]/)
    })

    it('returns empty string for empty input', () => {
      expect(escapeIcsText('')).toBe('')
    })
  })

  describe('generateDeterministicUid', () => {
    it('generates consistent and deterministic UID for the same item id', () => {
      const uid1 = generateDeterministicUid('task-42')
      const uid2 = generateDeterministicUid('task-42')
      expect(uid1).toBe(uid2)
      expect(uid1).toBe('task-42@goal-monitor')
    })

    it('produces distinct UIDs for different item ids', () => {
      const uidA = generateDeterministicUid('task-a')
      const uidB = generateDeterministicUid('task-b')
      expect(uidA).not.toBe(uidB)
    })

    it('preserves existing domain if id already contains @', () => {
      const customUid = 'custom-event-123@example.org'
      expect(generateDeterministicUid(customUid)).toBe(customUid)
    })

    it('sanitizes spaces in id to hyphens', () => {
      expect(generateDeterministicUid('task alpha 001')).toBe('task-alpha-001@goal-monitor')
    })

    it('supports custom uid domain', () => {
      expect(generateDeterministicUid('t1', 'my-domain.org')).toBe('t1@my-domain.org')
    })

    it('throws when id is empty or invalid', () => {
      expect(() => generateDeterministicUid('')).toThrow()
    })
  })

  describe('foldLine (RFC 5545 75-octet limit & Unicode safety)', () => {
    const getByteLength = (str: string) => new TextEncoder().encode(str).length

    it('leaves short lines untouched', () => {
      const shortLine = 'SUMMARY:短任务'
      expect(foldLine(shortLine)).toEqual([shortLine])
    })

    it('folds long ASCII lines so every line is <= 75 octets', () => {
      const line = 'DESCRIPTION:' + 'A'.repeat(160)
      const folded = foldLine(line)
      expect(folded.length).toBeGreaterThan(1)
      for (const l of folded) {
        expect(getByteLength(l)).toBeLessThanOrEqual(75)
      }
      for (let i = 1; i < folded.length; i++) {
        expect(folded[i].startsWith(' ')).toBe(true)
      }
      // Unfold round-trip restores original
      const restored = folded.map((l, idx) => (idx === 0 ? l : l.slice(1))).join('')
      expect(restored).toBe(line)
    })

    it('folds long Chinese text without splitting any 3-byte Chinese character', () => {
      // "中" is 3 bytes in UTF-8
      const chineseText = 'DESCRIPTION:' + '目标行动专注检查测试'.repeat(10) // 12 + 100 * 3 = 312 bytes
      const folded = foldLine(chineseText)

      expect(folded.length).toBeGreaterThan(1)
      for (let i = 0; i < folded.length; i++) {
        const lineBytes = getByteLength(folded[i])
        expect(lineBytes).toBeLessThanOrEqual(75)
        if (i > 0) {
          expect(folded[i].startsWith(' ')).toBe(true)
        }
      }

      // Verify no Chinese character was cut in half:
      // When decoding line by line, each line should be valid UTF-8 and contain only complete characters
      for (const line of folded) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(line))
        expect(decoded).toBe(line)
      }

      // Unfolded content matches original exactly
      const restored = folded.map((l, idx) => (idx === 0 ? l : l.slice(1))).join('')
      expect(restored).toBe(chineseText)
    })

    it('does not split 4-byte Unicode code points (such as emojis)', () => {
      // 71 bytes prefix + 4 bytes emoji 🚀 = 75 bytes (fits on line 1)
      // then "BBBB" goes to continuation line
      const lineWithEmoji = 'A'.repeat(71) + '🚀' + 'B'.repeat(30)
      const folded = foldLine(lineWithEmoji)

      expect(folded.length).toBe(2)
      expect(getByteLength(folded[0])).toBe(75)
      expect(folded[0].endsWith('🚀')).toBe(true)
      expect(folded[1].startsWith(' BBBB')).toBe(true)
      expect(getByteLength(folded[1])).toBeLessThanOrEqual(75)

      // 72 bytes prefix + 4 bytes emoji 🚀 = 76 bytes (> 75, so emoji must move entirely to line 2)
      const lineEmojiMoves = 'A'.repeat(72) + '🚀' + 'B'.repeat(30)
      const folded2 = foldLine(lineEmojiMoves)

      expect(folded2.length).toBe(2)
      expect(getByteLength(folded2[0])).toBe(72)
      expect(folded2[1].startsWith(' 🚀')).toBe(true)
      expect(getByteLength(folded2[1])).toBeLessThanOrEqual(75)

      // Verify valid UTF-8 on all lines
      for (const line of folded2) {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(line))
        expect(decoded).toBe(line)
      }

      const restored = folded2.map((l, idx) => (idx === 0 ? l : l.slice(1))).join('')
      expect(restored).toBe(lineEmojiMoves)
    })
  })

  describe('parseLocalIsoDateTime & formatUtcDateTime', () => {
    it('formats a date as YYYYMMDDTHHMMSSZ', () => {
      const date = new Date(Date.UTC(2026, 10, 20, 10, 30, 0))
      expect(formatUtcDateTime(date)).toBe('20261120T103000Z')
    })

    it('parses local ISO datetime strings with explicit timeZoneOffsetMinutes to UTC', () => {
      // 2026-11-20 18:30 in UTC+8 (offset = +480 minutes) -> 10:30 UTC
      const parsed = parseLocalIsoDateTime('2026-11-20T18:30:00', { timeZoneOffsetMinutes: 480 })
      expect(formatUtcDateTime(parsed)).toBe('20261120T103000Z')
    })

    it('handles ISO string without seconds', () => {
      const parsed = parseLocalIsoDateTime('2026-11-20T18:30', { timeZoneOffsetMinutes: 480 })
      expect(formatUtcDateTime(parsed)).toBe('20261120T103000Z')
    })

    it('handles space separator between date and time', () => {
      const parsed = parseLocalIsoDateTime('2026-11-20 18:30:00', { timeZoneOffsetMinutes: 480 })
      expect(formatUtcDateTime(parsed)).toBe('20261120T103000Z')
    })

    it('parses ISO string with explicit timezone offset or Z directly', () => {
      const parsedOffset = parseLocalIsoDateTime('2026-11-20T18:30:00+08:00')
      expect(formatUtcDateTime(parsedOffset)).toBe('20261120T103000Z')

      const parsedUtc = parseLocalIsoDateTime('2026-11-20T10:30:00Z')
      expect(formatUtcDateTime(parsedUtc)).toBe('20261120T103000Z')
    })

    it('accepts a Date object directly', () => {
      const date = new Date(Date.UTC(2026, 10, 20, 10, 30, 0))
      const parsed = parseLocalIsoDateTime(date)
      expect(formatUtcDateTime(parsed)).toBe('20261120T103000Z')
    })

    it('throws error for invalid datetime input', () => {
      expect(() => parseLocalIsoDateTime('not-a-date')).toThrow()
      expect(() => parseLocalIsoDateTime('')).toThrow()
      expect(() => parseLocalIsoDateTime(new Date(NaN))).toThrow()
    })
  })

  describe('exportCalendarToIcs - Full ICS generation', () => {
    const fixedNow = new Date('2026-11-20T08:00:00Z')

    it('emits CRLF lines across the entire document without lone LF or CR', () => {
      const items: CalendarExportItem[] = [
        {
          id: 'task-1',
          title: '第一个专注任务',
          scheduledStart: '2026-11-20T18:30:00+08:00',
          durationMinutes: 30,
          description: '专注执行',
        },
      ]

      const ics = exportCalendarToIcs(items, { now: fixedNow })

      // Ends with CRLF
      expect(ics.endsWith('\r\n')).toBe(true)
      // Split by CRLF: no remaining \r or \n inside lines
      const lines = ics.slice(0, -2).split('\r\n')
      for (const line of lines) {
        expect(line).not.toContain('\r')
        expect(line).not.toContain('\n')
      }
    })

    it('produces standards-compatible VCALENDAR wrapper and VEVENT properties', () => {
      const items: CalendarExportItem[] = [
        {
          id: 'a1',
          title: '比较目标岗位要求',
          scheduledStart: '2026-11-20T18:30:00+08:00',
          durationMinutes: 45,
          description: '保存岗位链接, 写下技能笔记。',
        },
      ]

      const ics = exportCalendarToIcs(items, {
        now: fixedNow,
        calendarName: 'Goal Monitor 专注日历',
      })

      expect(ics).toContain('BEGIN:VCALENDAR\r\n')
      expect(ics).toContain('VERSION:2.0\r\n')
      expect(ics).toContain('PRODID:-//Goal Monitor//Goal Monitor Calendar//EN\r\n')
      expect(ics).toContain('CALSCALE:GREGORIAN\r\n')
      expect(ics).toContain('METHOD:PUBLISH\r\n')
      expect(ics).toContain('X-WR-CALNAME:Goal Monitor 专注日历\r\n')
      expect(ics).toContain('BEGIN:VEVENT\r\n')
      expect(ics).toContain('UID:a1@goal-monitor\r\n')
      expect(ics).toContain('DTSTAMP:20261120T080000Z\r\n')
      expect(ics).toContain('DTSTART:20261120T103000Z\r\n')
      expect(ics).toContain('DTEND:20261120T111500Z\r\n')
      expect(ics).toContain('SUMMARY:比较目标岗位要求\r\n')
      expect(ics).toContain('DESCRIPTION:保存岗位链接\\, 写下技能笔记。\r\n')
      expect(ics).toContain('END:VEVENT\r\n')
      expect(ics).toContain('END:VCALENDAR\r\n')
    })

    it('generates empty calendar when items array is empty', () => {
      const ics = exportCalendarToIcs([], { now: fixedNow })
      expect(ics).toContain('BEGIN:VCALENDAR\r\n')
      expect(ics).toContain('END:VCALENDAR\r\n')
      expect(ics).not.toContain('BEGIN:VEVENT')
    })

    it('handles varied durations correctly (0m, 15m, 30m, 90m, 1440m)', () => {
      const baseStart = '2026-11-20T10:00:00Z'
      const testCases = [
        { duration: 0, expectedEnd: '20261120T100000Z' },
        { duration: 15, expectedEnd: '20261120T101500Z' },
        { duration: 30, expectedEnd: '20261120T103000Z' },
        { duration: 45, expectedEnd: '20261120T104500Z' },
        { duration: 90, expectedEnd: '20261120T113000Z' },
        { duration: 1440, expectedEnd: '20261121T100000Z' }, // Next day rollover
      ]

      for (const tc of testCases) {
        const item: CalendarExportItem = {
          id: `duration-${tc.duration}`,
          title: `Duration test ${tc.duration}m`,
          scheduledStart: baseStart,
          durationMinutes: tc.duration,
        }
        const ics = exportCalendarToIcs([item], { now: fixedNow })
        expect(ics).toContain(`DTSTART:20261120T100000Z\r\n`)
        expect(ics).toContain(`DTEND:${tc.expectedEnd}\r\n`)
      }
    })

    it('escapes complex punctuation, backslashes, semicolons, commas, and newlines in titles and descriptions', () => {
      const item: CalendarExportItem = {
        id: 'escape-test',
        title: '构建核心模块: src\\core; utils, types',
        scheduledStart: '2026-11-20T10:00:00Z',
        durationMinutes: 60,
        description: '第一行：环境准备\\n第二行：安装依赖;\\n第三行：运行测试, 保证通过。\r\n完成验收！',
      }

      const ics = exportCalendarToIcs([item], { now: fixedNow })

      // Title escaped
      expect(ics).toContain('SUMMARY:构建核心模块: src\\\\core\\; utils\\, types\r\n')
      // Description escaped: semicolons, commas, newlines escaped
      expect(ics).toContain('\\;')
      expect(ics).toContain('\\,')
      expect(ics).toContain('\\n完成验收！')
      // Unescaped literal newlines must not appear inside the property lines
      const lines = ics.split('\r\n')
      for (const line of lines) {
        expect(line).not.toContain('\n')
        expect(line).not.toContain('\r')
      }
    })

    it('ensures every physical line in exported ICS is <= 75 UTF-8 octets when containing long Chinese text', () => {
      const longTitle = '实现数据质量检查端到端验证并在本地完整跑通核心流水线测试任务'
      const longDescription =
        '【详细背景说明】此任务需要在本地完成自动化测试、数据管道校验以及生成质量报告。' +
        '包含以下关键交付物：1. 单元测试覆盖率报告；2. 运行截图；3. 架构设计笔记，包含路径：C:\\Users\\Project\\data\\pipeline.py；' +
        '4. 团队同行反馈意见记录（共计 3 位核心成员评审）。注意在下午 18:30 前完成归档提交！'

      const item: CalendarExportItem = {
        id: 'long-chinese-task',
        title: longTitle,
        scheduledStart: '2026-11-20T14:00:00Z',
        durationMinutes: 90,
        description: longDescription,
      }

      const ics = exportCalendarToIcs([item], {
        now: fixedNow,
        calendarName: 'Goal Monitor 长期目标推进管理看板日历',
      })

      const physicalLines = ics.slice(0, -2).split('\r\n')
      expect(physicalLines.length).toBeGreaterThan(10)

      for (let i = 0; i < physicalLines.length; i++) {
        const line = physicalLines[i]
        const byteLen = new TextEncoder().encode(line).length
        expect(byteLen).toBeLessThanOrEqual(75)

        // Continuation lines must start with space
        if (line.startsWith(' ')) {
          expect(i).toBeGreaterThan(0)
        }

        // Each line must be valid UTF-8 without truncated code units
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(line))
        expect(decoded).toBe(line)
      }

      // Unfold the ICS and verify contents are preserved
      const unfolded = ics.replace(/\r\n[ \t]/g, '')
      expect(unfolded).toContain(longTitle)
      expect(unfolded).toContain('【详细背景说明】')
      expect(unfolded).toContain('pipeline.py')
    })

    it('supports aliases generateIcsCalendar and exportIcs', () => {
      const item: CalendarExportItem = {
        id: 'alias-test',
        title: '别名测试',
        scheduledStart: '2026-11-20T10:00:00Z',
        durationMinutes: 30,
      }
      const ics1 = exportCalendarToIcs([item], { now: fixedNow })
      const ics2 = generateIcsCalendar([item], { now: fixedNow })
      const ics3 = exportIcs([item], { now: fixedNow })

      expect(ics1).toBe(ics2)
      expect(ics2).toBe(ics3)
    })

    it('deterministic UID verification: exports same items multiple times with stable UIDs', () => {
      const items: CalendarExportItem[] = [
        { id: 'task-alpha', title: '任务甲', scheduledStart: '2026-11-20T09:00:00Z', durationMinutes: 30 },
        { id: 'task-beta', title: '任务乙', scheduledStart: '2026-11-20T10:00:00Z', durationMinutes: 45 },
      ]

      const run1 = exportCalendarToIcs(items, { now: fixedNow })
      const run2 = exportCalendarToIcs(items, { now: fixedNow })

      // Exact identity across separate runs
      expect(run1).toBe(run2)
      expect(run1).toContain('UID:task-alpha@goal-monitor\r\n')
      expect(run1).toContain('UID:task-beta@goal-monitor\r\n')
    })

    it('omits DESCRIPTION line when description is not provided', () => {
      const item: CalendarExportItem = {
        id: 'no-desc',
        title: '无描述任务',
        scheduledStart: '2026-11-20T10:00:00Z',
        durationMinutes: 30,
      }
      const ics = exportCalendarToIcs([item], { now: fixedNow })
      expect(ics).not.toContain('DESCRIPTION:')
    })

    it('supports optional status property', () => {
      const item: CalendarExportItem = {
        id: 'confirmed-task',
        title: '已确认任务',
        scheduledStart: '2026-11-20T10:00:00Z',
        durationMinutes: 30,
        status: 'confirmed',
      }
      const ics = exportCalendarToIcs([item], { now: fixedNow })
      expect(ics).toContain('STATUS:CONFIRMED\r\n')
    })
  })
})
