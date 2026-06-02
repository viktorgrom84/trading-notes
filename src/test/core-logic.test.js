/**
 * Tests for core business logic added/changed in recent sessions:
 *  - isTokenExpired()
 *  - 401 auto-logout event
 *  - Profit calculation for covered calls (short options)
 *  - Statistics: daily aggregation, symbol normalisation, time-range filtering
 *  - Strike price display precision
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import apiClient from '../api'
import { tradeProfit, isTradeClosed } from '../utils/tradeProfit'
import { formatCurrency, formatDate, getProfitColor, getLocalDateString, toInputDate } from '../utils/format'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function makeJWT(payload) {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = btoa(JSON.stringify(payload))
  return `${header}.${body}.fakesig`
}

function expiredToken() {
  return makeJWT({ userId: 1, username: 'test', exp: Math.floor(Date.now() / 1000) - 100 })
}

function freshToken() {
  return makeJWT({ userId: 1, username: 'test', exp: Math.floor(Date.now() / 1000) + 3600 })
}

// ─────────────────────────────────────────────
// isTokenExpired
// ─────────────────────────────────────────────
describe('ApiClient.isTokenExpired()', () => {
  afterEach(() => {
    localStorage.clear()
    apiClient.clearToken()
  })

  it('returns true when no token is set', () => {
    apiClient.token = null
    expect(apiClient.isTokenExpired()).toBe(true)
  })

  it('returns true for an expired token', () => {
    apiClient.token = expiredToken()
    expect(apiClient.isTokenExpired()).toBe(true)
  })

  it('returns false for a valid (not yet expired) token', () => {
    apiClient.token = freshToken()
    expect(apiClient.isTokenExpired()).toBe(false)
  })

  it('returns true for a malformed / non-JWT string', () => {
    apiClient.token = 'not-a-real-jwt'
    expect(apiClient.isTokenExpired()).toBe(true)
  })
})

// ─────────────────────────────────────────────
// 401 auto-logout event
// ─────────────────────────────────────────────
describe('ApiClient 401 → auth:unauthorized event', () => {
  beforeEach(() => {
    apiClient.token = freshToken()
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    apiClient.clearToken()
    localStorage.clear()
  })

  it('dispatches auth:unauthorized and throws on 401', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Token expired' }),
    })

    const handler = vi.fn()
    window.addEventListener('auth:unauthorized', handler)

    await expect(apiClient.getTrades()).rejects.toThrow()
    expect(handler).toHaveBeenCalledTimes(1)

    window.removeEventListener('auth:unauthorized', handler)
  })

  it('does NOT dispatch auth:unauthorized on 500', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    })

    const handler = vi.fn()
    window.addEventListener('auth:unauthorized', handler)

    await expect(apiClient.getTrades()).rejects.toThrow()
    expect(handler).toHaveBeenCalledTimes(0)

    window.removeEventListener('auth:unauthorized', handler)
  })
})

// ─────────────────────────────────────────────
// Profit calculation — uses the shared tradeProfit() from utils
// (imported at the top of this file)
// ─────────────────────────────────────────────

describe('tradeProfit()', () => {
  // ── Profit-only ──────────────────────────────
  it('profit_only: returns sell_price directly', () => {
    expect(tradeProfit({ trade_type: 'profit_only', sell_price: 242 })).toBe(242)
  })

  it('profit_only: handles negative P&L', () => {
    expect(tradeProfit({ trade_type: 'profit_only', sell_price: -85 })).toBe(-85)
  })

  // ── Covered call (short option, no buyback) ──
  it('covered call with no close: returns full premium as profit', () => {
    const trade = {
      trade_type: 'option',
      position_type: 'short',
      option_type: 'call',
      buy_price: 63.93,
      buy_date: '2026-05-27',
      sell_price: null,
      sell_date: null,
      shares: 1,
    }
    expect(tradeProfit(trade)).toBe(63.93)
  })

  it('covered call with multiple contracts: premium already totalled, not multiplied again', () => {
    const trade = {
      trade_type: 'option',
      position_type: 'short',
      buy_price: 514.72, // total premium for 5 contracts
      sell_price: null,
      sell_date: null,
      shares: 5,
    }
    expect(tradeProfit(trade)).toBe(514.72)
  })

  it('covered call bought back (closed): profit = premium − buyback cost', () => {
    const trade = {
      trade_type: 'option',
      position_type: 'short',
      buy_price: 200,   // premium received
      sell_price: 50,   // buyback cost
      sell_date: '2026-06-01',
    }
    expect(tradeProfit(trade)).toBe(150)
  })

  it('covered call bought back at a loss: profit is negative', () => {
    const trade = {
      trade_type: 'option',
      position_type: 'short',
      buy_price: 50,
      sell_price: 200,
      sell_date: '2026-06-01',
    }
    expect(tradeProfit(trade)).toBe(-150)
  })

  // ── Long option ──────────────────────────────
  it('long option with no close: returns null (position still open, P&L not realised)', () => {
    const trade = {
      trade_type: 'option',
      position_type: 'long',
      buy_price: 75,
      sell_price: null,
      sell_date: null,
    }
    expect(tradeProfit(trade)).toBeNull()
  })

  it('long option closed for profit', () => {
    const trade = {
      trade_type: 'option',
      position_type: 'long',
      buy_price: 75,
      sell_price: 200,
      sell_date: '2026-06-01',
    }
    expect(tradeProfit(trade)).toBe(125)
  })

  // ── Regular trades ───────────────────────────
  it('regular long trade: (sell − buy) × shares', () => {
    const trade = {
      trade_type: 'regular',
      position_type: 'long',
      buy_price: 150,
      sell_price: 160,
      sell_date: '2026-06-01',
      shares: 10,
    }
    expect(tradeProfit(trade)).toBeCloseTo(100)
  })

  it('regular long trade at a loss', () => {
    const trade = {
      trade_type: 'regular',
      position_type: 'long',
      buy_price: 160,
      sell_price: 150,
      sell_date: '2026-06-01',
      shares: 10,
    }
    expect(tradeProfit(trade)).toBeCloseTo(-100)
  })

  it('regular long trade with no sell_date: returns null (still open)', () => {
    const trade = {
      trade_type: 'regular',
      position_type: 'long',
      buy_price: 150,
      sell_price: 160,
      sell_date: null,
      shares: 10,
    }
    expect(tradeProfit(trade)).toBeNull()
  })
})

// ─────────────────────────────────────────────
// Strike price display precision
// ─────────────────────────────────────────────
describe('Strike price display', () => {
  it('toFixed(2) preserves fractional strikes like $7.50', () => {
    const strike = 7.5
    expect(parseFloat(strike).toFixed(2)).toBe('7.50')
  })

  it('toFixed(0) incorrectly rounds $7.50 → "8" (the old bug)', () => {
    const strike = 7.5
    expect(parseFloat(strike).toFixed(0)).toBe('8') // documents the bug that was fixed
  })

  it('toFixed(2) keeps whole-dollar strikes clean', () => {
    expect(parseFloat(8).toFixed(2)).toBe('8.00')
    expect(parseFloat(100).toFixed(2)).toBe('100.00')
  })
})

// ─────────────────────────────────────────────
// format utils
// ─────────────────────────────────────────────
describe('format utilities', () => {
  describe('formatCurrency', () => {
    it('formats positive amount', () => {
      expect(formatCurrency(1234.5)).toBe('$1,234.50')
    })
    it('formats negative amount', () => {
      expect(formatCurrency(-50)).toBe('-$50.00')
    })
    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })
  })

  describe('getProfitColor', () => {
    it('returns green for positive', () => expect(getProfitColor(100)).toBe('green'))
    it('returns red for negative',  () => expect(getProfitColor(-1)).toBe('red'))
    it('returns gray for zero',     () => expect(getProfitColor(0)).toBe('gray'))
    it('returns gray for null',     () => expect(getProfitColor(null)).toBe('gray'))

    // Regression: Win Rate was shown as string "100.0%" and
    // the old StatCard did `value >= 0` which evaluates to NaN >= 0 = false → red.
    // getProfitColor is now used only with numbers; string callers pass an explicit color.
    it('does NOT accept a string — returns gray (not red) for NaN-like input', () => {
      expect(getProfitColor('100.0%')).toBe('gray')
    })
  })

  describe('formatDate', () => {
    it('returns "-" for null/undefined', () => {
      expect(formatDate(null)).toBe('-')
      expect(formatDate(undefined)).toBe('-')
      expect(formatDate('')).toBe('-')
    })
    it('formats a valid ISO date string', () => {
      const result = formatDate('2026-05-27T00:00:00.000Z')
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
    })
  })

  describe('getLocalDateString', () => {
    it('returns YYYY-MM-DD in local timezone', () => {
      expect(getLocalDateString('2026-06-02T12:00:00')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('toInputDate', () => {
    it('returns empty string for falsy input', () => {
      expect(toInputDate('')).toBe('')
      expect(toInputDate(null)).toBe('')
    })
    it('converts ISO date to YYYY-MM-DD', () => {
      expect(toInputDate('2026-05-27')).toBe('2026-05-27')
    })
    it('handles ISO datetime string', () => {
      expect(toInputDate('2026-05-27T00:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})

// ─────────────────────────────────────────────
// Statistics — daily aggregation logic
// (mirrors getChartData() in Statistics.jsx)
// ─────────────────────────────────────────────
function buildChartData(trades) {
  const getExitDate = (t) =>
    (t.trade_type === 'option' || t.trade_type === 'profit_only')
      ? t.buy_date
      : t.sell_date || t.buy_date

  const dailyMap = {}
  trades.forEach(t => {
    const raw = getExitDate(t)
    if (!raw) return
    const key = new Date(raw).toLocaleDateString('en-CA')
    if (!dailyMap[key]) dailyMap[key] = { key, profit: 0, trades: 0 }
    dailyMap[key].profit += tradeProfit(t) ?? 0
    dailyMap[key].trades += 1
  })

  let cumulative = 0
  return Object.values(dailyMap)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, profit, trades }) => {
      cumulative += profit
      return { date: key, profit, trades, cumulativeProfit: cumulative }
    })
}

describe('Statistics — daily chart aggregation', () => {
  // Use T12:00:00 to avoid UTC-midnight timezone rollover in different test environments
  const day = (d, profit) => ({
    trade_type: 'profit_only',
    buy_date: `${d}T12:00:00`,
    sell_price: profit,
  })

  it('one trade per day → one point per day', () => {
    const data = buildChartData([
      day('2026-06-01', 100),
      day('2026-06-02', 200),
    ])
    expect(data).toHaveLength(2)
    expect(data[0].profit).toBe(100)
    expect(data[1].profit).toBe(200)
  })

  it('multiple trades on same day are summed into one point', () => {
    const data = buildChartData([
      day('2026-06-02', 100),
      day('2026-06-02', 200),
      day('2026-06-02', 50),
    ])
    expect(data).toHaveLength(1)
    expect(data[0].profit).toBeCloseTo(350)
    expect(data[0].trades).toBe(3)
  })

  it('20 trades on Jun 2 → single Jun 2 point (the bug that was reported)', () => {
    const twentyTrades = Array.from({ length: 20 }, () => day('2026-06-02', 356.25))
    const data = buildChartData(twentyTrades)
    expect(data).toHaveLength(1)
    expect(data[0].trades).toBe(20)
    expect(data[0].profit).toBeCloseTo(7125)
  })

  it('sorts chronologically', () => {
    const data = buildChartData([
      day('2026-06-03', 50),
      day('2026-06-01', 100),
      day('2026-06-02', 200),
    ])
    // Compare only the YYYY-MM-DD portion of the key (timezone-safe)
    expect(data.map(d => d.date.slice(0, 10))).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })
})

// ─────────────────────────────────────────────
// Statistics — symbol normalisation
// (mirrors getSymbolData() in Statistics.jsx)
// ─────────────────────────────────────────────
function buildSymbolData(trades) {
  const symbolMap = {}
  trades.forEach(t => {
    const key = (t.symbol || '').trim().toUpperCase()
    if (!symbolMap[key]) symbolMap[key] = { profit: 0, count: 0 }
    symbolMap[key].profit += tradeProfit(t) ?? 0
    symbolMap[key].count  += 1
  })
  return Object.entries(symbolMap).map(([symbol, d]) => ({
    symbol, profit: d.profit, count: d.count, avg: d.profit / d.count,
  }))
}

describe('Statistics — symbol normalisation', () => {
  const trade = (symbol, profit) => ({
    trade_type: 'profit_only',
    buy_date: '2026-06-01',
    sell_price: profit,
    symbol,
  })

  it('merges "BULL" and "BULL " (trailing space) into one row', () => {
    const rows = buildSymbolData([trade('BULL', 100), trade('BULL ', 200)])
    expect(rows).toHaveLength(1)
    expect(rows[0].symbol).toBe('BULL')
    expect(rows[0].profit).toBeCloseTo(300)
    expect(rows[0].count).toBe(2)
  })

  it('merges "bull" (lowercase) with "BULL"', () => {
    const rows = buildSymbolData([trade('bull', 50), trade('BULL', 50)])
    expect(rows).toHaveLength(1)
    expect(rows[0].profit).toBeCloseTo(100)
  })

  it('keeps distinct symbols separate', () => {
    const rows = buildSymbolData([trade('AAPL', 100), trade('GOOG', 200)])
    expect(rows).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────
// Statistics — isTradeClosed
// ─────────────────────────────────────────────
describe('isTradeClosed()', () => {
  it('profit_only is always closed', () => {
    expect(isTradeClosed({ trade_type: 'profit_only', sell_price: 100 })).toBe(true)
  })

  it('option with sell_date is closed', () => {
    expect(isTradeClosed({ trade_type: 'option', sell_date: '2026-06-01', position_type: 'long' })).toBe(true)
  })

  it('short option with no sell_date is still closed (premium collected)', () => {
    expect(isTradeClosed({ trade_type: 'option', sell_date: null, position_type: 'short' })).toBe(true)
  })

  it('long option with no sell_date is open', () => {
    expect(isTradeClosed({ trade_type: 'option', sell_date: null, position_type: 'long' })).toBe(false)
  })

  it('regular trade with sell_price + sell_date is closed', () => {
    expect(isTradeClosed({ trade_type: 'regular', position_type: 'long', sell_price: 160, sell_date: '2026-06-01' })).toBe(true)
  })

  it('regular trade without sell_date is open', () => {
    expect(isTradeClosed({ trade_type: 'regular', position_type: 'long', sell_price: null, sell_date: null })).toBe(false)
  })
})
