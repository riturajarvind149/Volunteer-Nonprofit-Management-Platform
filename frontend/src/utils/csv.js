import { toInputDate } from './format.js'

/** Escape one CSV cell, neutralising spreadsheet formulas. */
export function csvCell(value) {
  let text = value == null ? '' : String(value)
  // Spreadsheet apps run cells starting with = + - @ (or tab/CR) as formulas. Prefix them so
  // names or notes typed by users can't execute when a coordinator opens the export.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * @param {{key: string, label: string, date?: boolean}[]} columns
 * @param {object[]} rows
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.label)).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(c.date ? toInputDate(row[c.key]) : row[c.key])).join(','))
  }
  // BOM so Excel opens UTF-8 names (e.g. Hindi, accented letters) correctly.
  return '﻿' + lines.join('\r\n')
}
