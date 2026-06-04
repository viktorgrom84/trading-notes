/**
 * Shared formatting utilities used across Dashboard, TradingNotes,
 * Calendar, Statistics, and AIAnalysis.
 *
 * TIMEZONE RULE
 * -------------
 * PostgreSQL DATE columns are returned by node-postgres as bare "YYYY-MM-DD"
 * strings. JavaScript's `new Date("YYYY-MM-DD")` treats bare date strings as
 * UTC midnight, which rolls the displayed date back one day for anyone west of
 * UTC (i.e. all of the Americas). The canonical fix used throughout this file
 * is to always append "T12:00:00" (local noon) before parsing, keeping the
 * date stable regardless of the user's timezone offset.
 */

/**
 * Parse any date value into a local Date object at local noon. Returns null on bad input.
 *
 * Handles:
 *   - Date objects          → returned as-is (already local)
 *   - "YYYY-MM-DD"          → parsed at local noon (avoids UTC-midnight rollback)
 *   - "YYYY-MM-DDTHH:MM:SS" → date part extracted, parsed at local noon
 */
export function parseLocalDate(date) {
  if (!date) return null
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return null
    // node-postgres returns DATE columns as Date objects at midnight UTC.
    // Use .toISOString() to get the correct UTC date string before re-parsing
    // at local noon — otherwise dates appear one day early in UTC-negative timezones.
    const datePart = date.toISOString().slice(0, 10)
    return new Date(datePart + 'T12:00:00')
  }
  const datePart = String(date).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  const d = new Date(datePart + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

/** Format a number as USD currency */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

/** Format a date string for display (e.g. "5/27/2026"), returns '-' on bad input. */
export function formatDate(dateString) {
  if (!dateString) return '-'
  try {
    const d = parseLocalDate(dateString)
    if (!d) return '-'
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })
  } catch {
    return '-'
  }
}

/**
 * Convert any date value to a "YYYY-MM-DD" string in the user's local timezone.
 * Used for grouping trades by calendar date.
 */
export function getLocalDateString(date) {
  const d = parseLocalDate(date)
  return d ? d.toLocaleDateString('en-CA') : ''
}

/**
 * Parse a DB date string and return a "YYYY-MM-DD" suitable for <input type="date">.
 */
export function toInputDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = parseLocalDate(dateStr)
    if (!d) return ''
    const year  = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day   = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return ''
  }
}

/** Return the Mantine color name for a P&L value */
export function getProfitColor(profit) {
  if (profit === null || profit === undefined) return 'gray'
  if (profit > 0) return 'green'
  if (profit < 0) return 'red'
  return 'gray'
}

/**
 * Compact number formatting for market cap / deal size values.
 * e.g. 1_200_000_000 → "$1.2B"
 */
export function formatLargeNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A'
  const n = Number(value)
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return formatCurrency(n)
}
