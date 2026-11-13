import { describe, it, expect } from 'vitest'
import { csvCell, toCsv } from './csv'
import { parseSkills } from './skills'

describe('CSV export', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Rao, Asha')).toBe('"Rao, Asha"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })

  it('neutralises spreadsheet formulas in text', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(csvCell('+91 98')).toBe("'+91 98")
    expect(csvCell('@sum')).toBe("'@sum")
  })

  it('leaves numbers alone, including negatives', () => {
    expect(csvCell(-2)).toBe('-2')
    expect(csvCell(3.5)).toBe('3.5')
  })

  it('builds a file with a header row, CRLF line endings and a UTF-8 BOM', () => {
    const csv = toCsv([{ key: 'name', label: 'Name' }, { key: 'day', label: 'Day', date: true }], [{ name: 'Asha', day: '2026-03-05' }])
    expect(csv).toBe('﻿Name,Day\r\nAsha,2026-03-05')
  })
})

describe('parseSkills', () => {
  it('splits, trims and de-duplicates case-insensitively', () => {
    expect(parseSkills(' First aid, lifting ,First Aid,, Hindi ')).toEqual(['First aid', 'lifting', 'Hindi'])
  })

  it('caps the list at 20 skills', () => {
    expect(parseSkills(Array.from({ length: 25 }, (_, i) => `s${i}`).join(','))).toHaveLength(20)
  })
})
