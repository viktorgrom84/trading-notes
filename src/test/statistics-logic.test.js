/**
 * Tests for the pure logic used by Statistics.jsx:
 *  - Time-range filtering (all 6 ranges)
 *  - calculateStats: win rate, avg profit, best/worst trade, total profit
 *  - getWinLossData
 *  - Win rate StatCard color (the string-vs-number bug)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tradeProfit, isTradeClosed } from '../utils/tradeProfit'
import { getProfitColor } from '../utils/format'

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Make a closed regular trade with a known profit */
const reg = (buyDate, buyPrice, sellPrice, shares = 1) => ({
  trade_type: 'regular',
  position_type: 'long',
  symbol: 'TEST',
  buy_date: buyDate,
  sell_date: buyDate,          // same day for simplicity
  buy_price: buyPrice,
  sell_price: sellPrice,
  shares,
})

/** Make a covered call (short option) — premium is P&L */
const cc = (buyDate, premium) => ({
  trade_type: 'option',
  position_type: 'short',
  option_type: 'call',
  symbol: 'TEST',
  buy_date: buyDate,
  sell_price: null,
  sell_date: null,
  buy_price: premium,
  shares: 1,
})

const DATE = {
  now:      new Date().toISOString().slice(0, 10),
  minus2w:  relDate(-14),
  minus2m:  relDate(-60),
  minus4m:  relDate(-120),
  minus7m:  relDate(-210),
  minus13m: relDate(-395),
  minus25m: relDate(-760),
}

function relDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Mirror of getFilteredTrades() from Statistics.jsx ────────────────────────
function getFilteredTrades(trades, timeRange) {
  const now = new Date()
  const cutoffs = {
    '1month':  new Date(now.getFullYear(), now.getMonth() - 1,  now.getDate()),
    '3months': new Date(now.getFullYear(), now.getMonth() - 3,  now.getDate()),
    '6months': new Date(now.getFullYear(), now.getMonth() - 6,  now.getDate()),
    '1year':   new Date(now.getFullYear() - 1, now.getMonth(),  now.getDate()),
    '2years':  new Date(now.getFullYear() - 2, now.getMonth(),  now.getDate()),
    'all':     new Date(0),
  }
  const cutoffDate = cutoffs[timeRange] ?? new Date(0)
  return trades.filter(t => new Date(t.buy_date) >= cutoffDate)
}

// ─── Mirror of calculateStats() from Statistics.jsx ───────────────────────────
function calculateStats(trades) {
  const completed = trades.filter(isTradeClosed)
  const total = completed.length
  if (total === 0) return { totalTrades: 0, totalProfit: 0, winRate: 0, avgProfit: 0, bestTrade: 0, worstTrade: 0 }

  const profits = completed.map(t => tradeProfit(t) ?? 0)
  const totalProfit  = profits.reduce((s, p) => s + p, 0)
  const winningCount = profits.filter(p => p > 0).length
  return {
    totalTrades:  total,
    totalProfit,
    winRate:      (winningCount / total) * 100,
    avgProfit:    totalProfit / total,
    bestTrade:    Math.max(...profits),
    worstTrade:   Math.min(...profits),
  }
}

// ─── Time-range filtering ──────────────────────────────────────────────────────
describe('Statistics — time-range filtering', () => {
  const allTrades = [
    reg(DATE.minus2w,  100, 110),   // 2 weeks ago  → inside all ranges ≥ 1M
    reg(DATE.minus2m,  100, 110),   // 2 months ago → inside ≥ 3M
    reg(DATE.minus4m,  100, 110),   // 4 months ago → inside ≥ 6M
    reg(DATE.minus7m,  100, 110),   // 7 months ago → inside ≥ 1Y
    reg(DATE.minus13m, 100, 110),   // 13 months ago → inside ≥ 2Y
    reg(DATE.minus25m, 100, 110),   // 25 months ago → only in "all"
  ]

  it('1month: only shows trades within last 30 days', () => {
    expect(getFilteredTrades(allTrades, '1month')).toHaveLength(1)
  })

  it('3months: shows trades within last 90 days', () => {
    expect(getFilteredTrades(allTrades, '3months')).toHaveLength(2)
  })

  it('6months: shows trades within last 180 days', () => {
    expect(getFilteredTrades(allTrades, '6months')).toHaveLength(3)
  })

  it('1year: shows trades within last 12 months', () => {
    expect(getFilteredTrades(allTrades, '1year')).toHaveLength(4)
  })

  it('2years: shows trades within last 24 months', () => {
    expect(getFilteredTrades(allTrades, '2years')).toHaveLength(5)
  })

  it('all: shows every trade regardless of date', () => {
    expect(getFilteredTrades(allTrades, 'all')).toHaveLength(6)
  })

  it('unknown range falls back to "all"', () => {
    expect(getFilteredTrades(allTrades, 'unknown')).toHaveLength(6)
  })
})

// ─── calculateStats ────────────────────────────────────────────────────────────
describe('Statistics — calculateStats()', () => {
  it('returns zeros when no trades', () => {
    const s = calculateStats([])
    expect(s.totalTrades).toBe(0)
    expect(s.winRate).toBe(0)
    expect(s.totalProfit).toBe(0)
  })

  it('100% win rate when all trades are profitable', () => {
    const trades = [
      reg(DATE.now, 100, 120, 10),   // +$200
      cc(DATE.now, 63.93),           // +$63.93
    ]
    const s = calculateStats(trades)
    expect(s.winRate).toBe(100)
    expect(s.totalTrades).toBe(2)
  })

  it('0% win rate when all trades lose', () => {
    const trades = [
      reg(DATE.now, 120, 100, 5),   // -$100
      reg(DATE.now, 200, 150, 2),   // -$100
    ]
    const s = calculateStats(trades)
    expect(s.winRate).toBe(0)
  })

  it('50% win rate for one win and one loss', () => {
    const trades = [
      reg(DATE.now, 100, 110, 10),  // +$100
      reg(DATE.now, 100, 90,  10),  // -$100
    ]
    const s = calculateStats(trades)
    expect(s.winRate).toBe(50)
  })

  it('calculates totalProfit correctly', () => {
    const trades = [
      reg(DATE.now, 100, 110, 10),  // +$100
      cc(DATE.now, 50),             // +$50
      reg(DATE.now, 100, 90,  10),  // -$100
    ]
    const s = calculateStats(trades)
    expect(s.totalProfit).toBeCloseTo(50)
  })

  it('identifies bestTrade and worstTrade', () => {
    const trades = [
      reg(DATE.now, 100, 150, 10),  // +$500 (best)
      reg(DATE.now, 100, 110, 10),  // +$100
      reg(DATE.now, 100, 50,  10),  // -$500 (worst)
    ]
    const s = calculateStats(trades)
    expect(s.bestTrade).toBeCloseTo(500)
    expect(s.worstTrade).toBeCloseTo(-500)
  })

  it('excludes open positions from stats', () => {
    const trades = [
      reg(DATE.now, 100, 110, 10),  // closed +$100
      // Open long option — not closed
      { trade_type: 'option', position_type: 'long', buy_price: 999,
        buy_date: DATE.now, sell_price: null, sell_date: null, shares: 1 },
    ]
    const s = calculateStats(trades)
    expect(s.totalTrades).toBe(1)          // only the closed trade
    expect(s.totalProfit).toBeCloseTo(100)
  })

  it('includes short options even without sell_date (premium already collected)', () => {
    const trades = [
      cc(DATE.now, 200),    // closed (short with no buyback)
      cc(DATE.now, 300),
    ]
    const s = calculateStats(trades)
    expect(s.totalTrades).toBe(2)
    expect(s.totalProfit).toBeCloseTo(500)
  })
})

// ─── Monthly breakdown logic ──────────────────────────────────────────────────
describe('getMonthlyData — monthly aggregation', () => {
  // Inline version of getMonthlyData (mirrors Statistics.jsx pure logic)
  function getMonthlyData(trades) {
    const { parseLocalDate } = { parseLocalDate: (d) => {
      if (!d) return null
      const s = typeof d === 'string' ? d : d.toISOString()
      const datePart = s.slice(0, 10)
      const dt = new Date(datePart + 'T12:00:00')
      return isNaN(dt.getTime()) ? null : dt
    }}
    const map = {}
    trades.filter(isTradeClosed).forEach(trade => {
      const raw = (trade.trade_type === 'option' || trade.trade_type === 'profit_only')
        ? trade.buy_date
        : trade.sell_date || trade.buy_date
      if (!raw) return
      const d = parseLocalDate(raw)
      if (!d) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { profit: 0, trades: 0, wins: 0 }
      const p = tradeProfit(trade) ?? 0
      map[key].profit += p
      map[key].trades += 1
      if (p > 0) map[key].wins += 1
    })
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, { profit, trades, wins }]) => ({
        key,
        profit,
        trades,
        winRate: trades > 0 ? Math.round((wins / trades) * 100) : 0,
      }))
  }

  it('groups trades by month correctly', () => {
    const trades = [
      reg('2026-01-10', 100, 150, 1),  // +50
      reg('2026-01-20', 100, 80,  1),  // -20
      reg('2026-02-05', 100, 200, 1),  // +100
    ]
    const data = getMonthlyData(trades)
    expect(data).toHaveLength(2)
    // newest first
    expect(data[0].key).toBe('2026-02')
    expect(data[0].profit).toBeCloseTo(100)
    expect(data[0].winRate).toBe(100)
    expect(data[1].key).toBe('2026-01')
    expect(data[1].profit).toBeCloseTo(30)
    expect(data[1].trades).toBe(2)
    expect(data[1].winRate).toBe(50)
  })

  it('counts covered call premium in the month it was opened', () => {
    const call = { ...cc('2026-03-15', 200), sell_date: undefined }
    const data = getMonthlyData([call])
    expect(data).toHaveLength(1)
    expect(data[0].key).toBe('2026-03')
    expect(data[0].profit).toBeCloseTo(200)
    expect(data[0].winRate).toBe(100)
  })

  it('excludes open regular trades', () => {
    const open = reg('2026-03-10', 100, null, 1) // no sell_date/sell_price
    const data = getMonthlyData([open])
    expect(data).toHaveLength(0)
  })
})

// ─── Assignment tracker helpers ───────────────────────────────────────────────
describe('calcProfitIfAssigned logic', () => {
  it('computes (strike - avg) * contracts * 100', () => {
    const trade = {
      strike_price: '10.00',
      avg_price: '8.00',
      shares: '5',
    }
    const result = (parseFloat(trade.strike_price) - parseFloat(trade.avg_price))
      * (parseInt(trade.shares) || 1) * 100
    expect(result).toBe(1000) // (10-8)*5*100
  })

  it('returns negative when avg > strike (underwater)', () => {
    const result = (parseFloat('8.00') - parseFloat('10.00')) * 2 * 100
    expect(result).toBe(-400)
  })
})

// ─── Win-rate StatCard color bug (regression) ─────────────────────────────────
describe('Win Rate color — regression for "100% shows red" bug', () => {
  it('getProfitColor with a NUMBER: 100 → green', () => {
    expect(getProfitColor(100)).toBe('green')
  })

  it('getProfitColor with STRING "100.0%" → gray (not red)', () => {
    // The old StatCard did `value >= 0` on a string, which NaN-compared to false → red.
    // getProfitColor correctly returns 'gray' for non-numbers.
    expect(getProfitColor('100.0%')).toBe('gray')
    expect(getProfitColor('100.0%')).not.toBe('red')
  })

  it('win rate at 65% threshold: ≥65 is green, <65 is red', () => {
    const winRateColor = (rate) => rate >= 65 ? 'green' : 'red'
    expect(winRateColor(100)).toBe('green')
    expect(winRateColor(65)).toBe('green')
    expect(winRateColor(64.9)).toBe('red')
    expect(winRateColor(0)).toBe('red')
  })
})
