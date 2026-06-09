/**
 * Pure helper functions for options calculations.
 * Extracted here so they can be unit-tested independently.
 */

/**
 * Count Mon–Fri trading days between today and the expiration date.
 * Returns  0  if today
 *          positive  if in the future
 *          negative  if in the past (-1 minimum so a just-expired option
 *                    viewed on the weekend doesn't show as 0 / "today")
 */
export function daysToExpiry(expirationDate) {
  if (!expirationDate) return null
  const datePart = String(expirationDate).slice(0, 10)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(datePart + 'T12:00:00')
  if (isNaN(exp.getTime())) return null
  exp.setHours(0, 0, 0, 0)

  if (exp.getTime() === today.getTime()) return 0

  const forward = exp > today
  const from = forward ? today : exp
  const to   = forward ? exp   : today

  let count = 0
  const cursor = new Date(from)
  cursor.setDate(cursor.getDate() + 1)
  while (cursor <= to) {
    const dow = cursor.getDay()
    if (dow >= 1 && dow <= 5) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  // If the calendar date already passed but no trading days in between
  // (e.g. option expired Friday, viewing on Saturday/Sunday) → expired (-1).
  return forward ? count : (count === 0 ? -1 : -count)
}

/**
 * Premium yield as a percentage of capital deployed.
 * Formula: premium / (avg_price × contracts × 100) × 100
 * Returns null if any required field is missing or invalid.
 */
export function calcPremiumYield(trade) {
  const premium   = parseFloat(trade.buy_price)
  const avg       = parseFloat(trade.avg_price)
  const contracts = parseInt(trade.shares) || 1
  if (!trade.avg_price || isNaN(avg) || avg <= 0 || isNaN(premium)) return null
  return (premium / (avg * contracts * 100)) * 100
}

/**
 * Profit if shares are called away (covered call) or put to you (CSP).
 * Formula: (strike − avg_price) × contracts × 100
 * Returns null if avg_price is not set.
 */
export function calcProfitIfAssigned(trade) {
  const strike    = parseFloat(trade.strike_price)
  const avgCost   = parseFloat(trade.avg_price)
  const contracts = parseInt(trade.shares) || 1
  if (!trade.avg_price && trade.avg_price !== 0) return null
  if (isNaN(strike) || isNaN(avgCost)) return null
  return (strike - avgCost) * contracts * 100
}
