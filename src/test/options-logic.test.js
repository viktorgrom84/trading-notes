/**
 * Unit tests for src/utils/options.js
 *
 * Covers:
 *  - daysToExpiry  (trading-day counting, weekend edge cases)
 *  - calcPremiumYield
 *  - calcProfitIfAssigned
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { daysToExpiry, calcPremiumYield, calcProfitIfAssigned } from '../utils/options'

// ─── helpers ──────────────────────────────────────────────────────────────────
/** Pin "today" to a known weekday so tests are deterministic. */
function setToday(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  vi.setSystemTime(d)
}

afterEach(() => { vi.useRealTimers() })

// ─────────────────────────────────────────────
// daysToExpiry
// ─────────────────────────────────────────────
describe('daysToExpiry', () => {
  it('returns null for missing date', () => {
    expect(daysToExpiry(null)).toBeNull()
    expect(daysToExpiry(undefined)).toBeNull()
    expect(daysToExpiry('')).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(daysToExpiry('not-a-date')).toBeNull()
  })

  it('returns 0 when expiry is today (Wednesday)', () => {
    vi.useFakeTimers()
    setToday('2025-06-04') // Wednesday
    expect(daysToExpiry('2025-06-04')).toBe(0)
  })

  it('counts 1 trading day for next-day expiry (Thu → Fri)', () => {
    vi.useFakeTimers()
    setToday('2025-06-05') // Thursday
    expect(daysToExpiry('2025-06-06')).toBe(1) // Friday
  })

  it('counts 5 trading days across a full Mon–Fri week', () => {
    vi.useFakeTimers()
    setToday('2025-06-02') // Monday
    expect(daysToExpiry('2025-06-09')).toBe(5) // next Monday — Mon→Fri = 5 days
  })

  it('skips weekend days when counting forward', () => {
    vi.useFakeTimers()
    setToday('2025-06-06') // Friday
    // Saturday and Sunday should not count; next Monday is 1 trading day away
    expect(daysToExpiry('2025-06-09')).toBe(1) // Monday
  })

  it('returns negative for past expiry', () => {
    vi.useFakeTimers()
    setToday('2025-06-11') // Wednesday
    expect(daysToExpiry('2025-06-09')).toBe(-2) // 2 trading days ago (Mon + Tue)
  })

  it('returns -1 when option expired Friday and today is Saturday (weekend edge case)', () => {
    vi.useFakeTimers()
    setToday('2025-06-07') // Saturday
    // Expired yesterday (Friday) — 0 trading days between Sat and Fri but calendar date passed
    expect(daysToExpiry('2025-06-06')).toBe(-1)
  })

  it('returns -1 when option expired Friday and today is Sunday', () => {
    vi.useFakeTimers()
    setToday('2025-06-08') // Sunday
    expect(daysToExpiry('2025-06-06')).toBe(-1)
  })

  it('handles ISO datetime strings (slices to YYYY-MM-DD)', () => {
    vi.useFakeTimers()
    setToday('2025-06-04') // Wednesday
    expect(daysToExpiry('2025-06-04T00:00:00.000Z')).toBe(0)
  })

  it('counts correctly over a two-week span with two weekends', () => {
    vi.useFakeTimers()
    setToday('2025-06-02') // Monday
    // 2025-06-16 is a Monday — 10 trading days (Mon–Fri × 2)
    expect(daysToExpiry('2025-06-16')).toBe(10)
  })
})

// ─────────────────────────────────────────────
// calcPremiumYield
// ─────────────────────────────────────────────
describe('calcPremiumYield', () => {
  it('computes (premium / (avg * contracts * 100)) * 100', () => {
    // $131.93 premium, $68 avg, 1 contract → 131.93 / 6800 * 100 ≈ 1.94%
    const result = calcPremiumYield({ buy_price: '131.93', avg_price: '68', shares: '1' })
    expect(result).toBeCloseTo(1.94, 1)
  })

  it('accounts for multiple contracts', () => {
    // $200 premium, $10 avg, 2 contracts → 200 / (10*2*100) * 100 = 10%
    const result = calcPremiumYield({ buy_price: '200', avg_price: '10', shares: '2' })
    expect(result).toBeCloseTo(10, 4)
  })

  it('defaults contracts to 1 when shares is missing/zero', () => {
    const result = calcPremiumYield({ buy_price: '50', avg_price: '100', shares: '0' })
    expect(result).toBeCloseTo(0.5, 4) // 50 / (100*1*100) * 100
  })

  it('returns null when avg_price is missing', () => {
    expect(calcPremiumYield({ buy_price: '100', shares: '1' })).toBeNull()
  })

  it('returns null when avg_price is 0 (avoid division by zero)', () => {
    expect(calcPremiumYield({ buy_price: '100', avg_price: '0', shares: '1' })).toBeNull()
  })

  it('returns null when buy_price is not a number', () => {
    expect(calcPremiumYield({ buy_price: 'abc', avg_price: '50', shares: '1' })).toBeNull()
  })
})

// ─────────────────────────────────────────────
// calcProfitIfAssigned
// ─────────────────────────────────────────────
describe('calcProfitIfAssigned', () => {
  it('computes (strike − avg) * contracts * 100', () => {
    // (10 - 8) * 5 * 100 = 1000
    expect(calcProfitIfAssigned({ strike_price: '10', avg_price: '8', shares: '5' })).toBe(1000)
  })

  it('returns negative when avg > strike (underwater position)', () => {
    // (8 - 10) * 2 * 100 = -400
    expect(calcProfitIfAssigned({ strike_price: '8', avg_price: '10', shares: '2' })).toBe(-400)
  })

  it('defaults contracts to 1 when shares is missing', () => {
    expect(calcProfitIfAssigned({ strike_price: '50', avg_price: '40' })).toBe(1000)
  })

  it('returns null when avg_price is missing', () => {
    expect(calcProfitIfAssigned({ strike_price: '50', shares: '1' })).toBeNull()
  })

  it('returns null when strike_price is not a number', () => {
    expect(calcProfitIfAssigned({ strike_price: 'n/a', avg_price: '40', shares: '1' })).toBeNull()
  })

  it('handles avg_price of 0 (free shares edge case)', () => {
    // (50 - 0) * 1 * 100 = 5000
    expect(calcProfitIfAssigned({ strike_price: '50', avg_price: '0', shares: '1' })).toBe(5000)
  })
})
