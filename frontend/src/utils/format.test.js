import { describe, it, expect } from 'vitest'
import { parseDate, spotsLabel, pluralize, formatHours, isUpcoming, toInputDate, compareByDate } from './format'

describe('parseDate', () => {
  it('parses a plain YYYY-MM-DD as a local date (no timezone shift)', () => {
    const date = parseDate('2026-03-05')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(5)
  })

  it('returns null for empty or invalid values', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate(null)).toBeNull()
    expect(parseDate('not a date')).toBeNull()
  })
})

describe('spotsLabel (capacity display)', () => {
  it('shows remaining spots out of capacity', () => {
    expect(spotsLabel({ spots_remaining: 3, capacity: 10 })).toBe('3 of 10 spots left')
  })

  it('shows Full at exact capacity and when over', () => {
    expect(spotsLabel({ spots_remaining: 0, capacity: 10 })).toBe('Full')
    expect(spotsLabel({ spots_remaining: -1, capacity: 10 })).toBe('Full')
  })

  it('returns null when the API sent no capacity info', () => {
    expect(spotsLabel({ capacity: 10 })).toBeNull()
  })
})

describe('small formatters', () => {
  it('pluralizes counts', () => {
    expect(pluralize(1, 'volunteer')).toBe('1 volunteer')
    expect(pluralize(2, 'volunteer')).toBe('2 volunteers')
    expect(pluralize(0, 'opportunity', 'opportunities')).toBe('0 opportunities')
  })

  it('formats hours as whole numbers or one decimal', () => {
    expect(formatHours(4)).toBe('4')
    expect(formatHours('2.50')).toBe('2.5')
    expect(formatHours(null)).toBe('0')
  })

  it('treats today and later as upcoming, earlier as past', () => {
    expect(isUpcoming(toInputDate(new Date()))).toBe(true)
    expect(isUpcoming('2099-01-01')).toBe(true)
    expect(isUpcoming('2020-01-01')).toBe(false)
    expect(isUpcoming(null)).toBe(false)
  })

  it('sorts by event date with missing dates last', () => {
    const items = [{ event_date: '2026-05-02' }, { event_date: null }, { event_date: '2026-01-15' }]
    expect(items.sort(compareByDate).map((i) => i.event_date)).toEqual(['2026-01-15', '2026-05-02', null])
  })
})
