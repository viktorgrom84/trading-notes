/**
 * Unit tests for src/utils/scanner.js
 *
 * Covers:
 *   computeRSI              — Wilder's smoothing, edge cases
 *   computeVolumeTrend      — down/up volume ratio
 *   countConsecutiveRed     — streak detection
 *   detectSlowGrind         — grind pattern recognition
 *   computeHV               — 30d historical volatility
 *   computeAccumulationScore — weighted scoring and breakdown
 *   scoreLabel              — label/color mapping
 */
import { describe, it, expect } from 'vitest'
import {
  computeRSI,
  computeVolumeTrend,
  countConsecutiveRed,
  detectSlowGrind,
  computeHV,
  computeAccumulationScore,
  scoreLabel,
} from '../utils/scanner'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a price series that trends in a direction from a base. */
function trendingPrices(start, change, n) {
  return Array.from({ length: n }, (_, i) => +(start + change * i).toFixed(2))
}

/** Flat series (RSI = 50-ish territory, all changes = 0) */
function flatPrices(price, n) {
  return Array.from({ length: n }, () => price)
}

// ─────────────────────────────────────────────────────────────────────────────
// computeRSI
// ─────────────────────────────────────────────────────────────────────────────
describe('computeRSI', () => {
  it('returns null when fewer than 15 data points', () => {
    expect(computeRSI([1, 2, 3])).toBeNull()
    expect(computeRSI([])).toBeNull()
    expect(computeRSI(null)).toBeNull()
  })

  it('returns 100 for a perfectly ascending series (no losses)', () => {
    const prices = trendingPrices(10, 1, 30)
    expect(computeRSI(prices)).toBe(100)
  })

  it('returns 0 for a perfectly descending series (no gains)', () => {
    const prices = trendingPrices(50, -1, 30)
    expect(computeRSI(prices)).toBe(0)
  })

  it('returns approximately 50 for an alternating series', () => {
    const prices = []
    for (let i = 0; i < 40; i++) prices.push(i % 2 === 0 ? 10 : 11)
    const rsi = computeRSI(prices)
    expect(rsi).toBeGreaterThan(40)
    expect(rsi).toBeLessThan(60)
  })

  it('returns a lower value for a mostly-declining series', () => {
    const prices = []
    for (let i = 0; i < 30; i++) prices.push(100 - i * 1.5 + (i % 3 === 0 ? 0.5 : 0))
    const rsi = computeRSI(prices)
    expect(rsi).toBeLessThan(40)
  })

  it('result is between 0 and 100 inclusive', () => {
    const prices = [5,6,4,7,3,8,2,9,1,10,5,6,4,7,3,8,2,9,1,10]
    const rsi = computeRSI(prices)
    expect(rsi).toBeGreaterThanOrEqual(0)
    expect(rsi).toBeLessThanOrEqual(100)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeVolumeTrend
// ─────────────────────────────────────────────────────────────────────────────
describe('computeVolumeTrend', () => {
  it('ratio < 1 when down days have lower volume (accumulation)', () => {
    const closes  = [10, 9,  11, 8,  12]
    const volumes = [0,  500, 2000, 400, 2500]
    const { ratio } = computeVolumeTrend(closes, volumes)
    expect(ratio).toBeLessThan(1)
  })

  it('ratio > 1 when down days have higher volume (distribution)', () => {
    const closes  = [10, 9,    11,  8,    12]
    const volumes = [0,  3000, 500, 3000, 500]
    const { ratio } = computeVolumeTrend(closes, volumes)
    expect(ratio).toBeGreaterThan(1)
  })

  it('returns null ratio when there are no up-day volumes', () => {
    // All closes descending — no up days
    const closes  = [10, 9, 8, 7, 6]
    const volumes = [0, 100, 200, 300, 400]
    const { ratio } = computeVolumeTrend(closes, volumes)
    expect(ratio).toBeNull()
  })

  it('counts down and up days correctly', () => {
    const closes  = [10, 9, 8, 11, 12]
    const volumes = [0, 100, 100, 200, 200]
    const { downDays, upDays } = computeVolumeTrend(closes, volumes)
    expect(downDays).toBe(2)
    expect(upDays).toBe(2)
  })

  it('skips null/zero volumes', () => {
    const closes  = [10, 9, 11, 8, 12]
    const volumes = [0, null, 0, null, 0]
    const { avgVol } = computeVolumeTrend(closes, volumes)
    expect(avgVol).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// countConsecutiveRed
// ─────────────────────────────────────────────────────────────────────────────
describe('countConsecutiveRed', () => {
  it('returns 0 for an ascending series', () => {
    expect(countConsecutiveRed([10, 11, 12, 13])).toBe(0)
  })

  it('counts trailing red days correctly', () => {
    // Last 3 are red: 12→11→10→9
    expect(countConsecutiveRed([8, 12, 11, 10, 9])).toBe(3)
  })

  it('stops counting when a green day interrupts', () => {
    // 10→11 (green) → streak resets
    expect(countConsecutiveRed([8, 9, 7, 10, 11, 9, 8])).toBe(2)
  })

  it('handles flat closes as non-red', () => {
    expect(countConsecutiveRed([10, 10, 10])).toBe(0)
  })

  it('returns length-1 for fully descending series', () => {
    expect(countConsecutiveRed([10, 9, 8, 7, 6])).toBe(4)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// detectSlowGrind
// ─────────────────────────────────────────────────────────────────────────────
describe('detectSlowGrind', () => {
  it('detects a slow grind — many red days + small ranges', () => {
    // 20 days, 14 red (70%), tiny ranges (0.5% of price)
    const n = 20
    const closes = []
    const highs  = []
    const lows   = []
    for (let i = 0; i < n; i++) {
      const c = 100 - i * 0.3 + (i % 5 === 0 ? 0.2 : 0)
      closes.push(c)
      highs.push(c + c * 0.005)
      lows.push( c - c * 0.005)
    }
    const { isGrinding } = detectSlowGrind(closes, highs, lows)
    expect(isGrinding).toBe(true)
  })

  it('does NOT detect grind when ranges are large (panic selling)', () => {
    const n = 20
    const closes = []
    const highs  = []
    const lows   = []
    for (let i = 0; i < n; i++) {
      const c = 100 - i * 0.5
      closes.push(c)
      highs.push(c + c * 0.08)  // 8% range
      lows.push( c - c * 0.08)
    }
    const { isGrinding } = detectSlowGrind(closes, highs, lows)
    expect(isGrinding).toBe(false)
  })

  it('does NOT detect grind when mostly green days', () => {
    const closes = trendingPrices(90, 0.5, 20)
    const highs  = closes.map(c => c + 0.3)
    const lows   = closes.map(c => c - 0.3)
    const { isGrinding } = detectSlowGrind(closes, highs, lows)
    expect(isGrinding).toBe(false)
  })

  it('returns downPct as a percentage (0-100)', () => {
    const closes = trendingPrices(10, -0.1, 20)
    const highs  = closes.map(c => c + 0.1)
    const lows   = closes.map(c => c - 0.1)
    const { downPct } = detectSlowGrind(closes, highs, lows)
    expect(downPct).toBeGreaterThanOrEqual(0)
    expect(downPct).toBeLessThanOrEqual(100)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeHV
// ─────────────────────────────────────────────────────────────────────────────
describe('computeHV', () => {
  it('returns null for fewer than 2 valid closes', () => {
    expect(computeHV([])).toBeNull()
    expect(computeHV([10])).toBeNull()
  })

  it('returns 0 for a perfectly flat series', () => {
    expect(computeHV(flatPrices(50, 32))).toBe(0)
  })

  it('returns a positive number for a volatile series', () => {
    const closes = []
    for (let i = 0; i < 35; i++) closes.push(50 + (i % 2 === 0 ? 3 : -3))
    const hv = computeHV(closes)
    expect(hv).toBeGreaterThan(0)
  })

  it('filters out null values', () => {
    const closes = [null, 10, null, 11, null, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10]
    expect(() => computeHV(closes)).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeAccumulationScore
// ─────────────────────────────────────────────────────────────────────────────
describe('computeAccumulationScore', () => {
  const base = {
    rsi: null, volumeRatio: null, pctFromHigh: null, hv: null,
    consecutiveRed: 0, isGrinding: false, insiderBuy: false, buyback: false,
  }

  it('returns 0 with no signals', () => {
    const { score } = computeAccumulationScore(base)
    expect(score).toBe(0)
  })

  it('never exceeds 100', () => {
    const { score } = computeAccumulationScore({
      rsi: 20, volumeRatio: 0.4, pctFromHigh: -70, hv: 90,
      consecutiveRed: 10, isGrinding: true, insiderBuy: true, buyback: true,
    })
    expect(score).toBeLessThanOrEqual(100)
  })

  it('RSI < 25 gives 25 pts', () => {
    const { score, breakdown } = computeAccumulationScore({ ...base, rsi: 22 })
    expect(score).toBe(25)
    expect(breakdown[0].pts).toBe(25)
    expect(breakdown[0].level).toBe('strong')
  })

  it('RSI 30–35 gives 18 pts', () => {
    const { score } = computeAccumulationScore({ ...base, rsi: 33 })
    expect(score).toBe(18)
  })

  it('RSI >= 50 gives 0 pts', () => {
    const { score } = computeAccumulationScore({ ...base, rsi: 55 })
    expect(score).toBe(0)
  })

  it('volumeRatio < 0.60 gives 25 pts', () => {
    const { score } = computeAccumulationScore({ ...base, volumeRatio: 0.5 })
    expect(score).toBe(25)
  })

  it('volumeRatio >= 0.90 gives 0 pts', () => {
    const { score } = computeAccumulationScore({ ...base, volumeRatio: 0.95 })
    expect(score).toBe(0)
  })

  it('60%+ drop from 52w high gives 20 pts', () => {
    const { score } = computeAccumulationScore({ ...base, pctFromHigh: -65 })
    expect(score).toBe(20)
  })

  it('both insiderBuy + buyback gives 10 pts', () => {
    const { score } = computeAccumulationScore({ ...base, insiderBuy: true, buyback: true })
    expect(score).toBe(10)
  })

  it('buyback only gives 7 pts', () => {
    const { score } = computeAccumulationScore({ ...base, buyback: true })
    expect(score).toBe(7)
  })

  it('isGrinding gives 10 pts', () => {
    const { score } = computeAccumulationScore({ ...base, isGrinding: true, consecutiveRed: 7 })
    expect(score).toBe(10)
  })

  it('breakdown contains one entry per signal checked', () => {
    const { breakdown } = computeAccumulationScore({
      rsi: 28, volumeRatio: 0.55, pctFromHigh: -50, hv: 60,
      consecutiveRed: 4, isGrinding: false, insiderBuy: false, buyback: true,
    })
    // RSI, volume, price, hv, red days (mild), buyback = 6 entries
    expect(breakdown.length).toBe(6)
  })

  it('adds up individual pts to match total score (no cap case)', () => {
    const signals = {
      rsi: 33, volumeRatio: 0.7, pctFromHigh: -30, hv: 45,
      consecutiveRed: 2, isGrinding: false, insiderBuy: false, buyback: false,
    }
    const { score, breakdown } = computeAccumulationScore(signals)
    const sumPts = breakdown.reduce((s, b) => s + b.pts, 0)
    expect(score).toBe(sumPts)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// scoreLabel
// ─────────────────────────────────────────────────────────────────────────────
describe('scoreLabel', () => {
  it('returns green / Strong Accumulation for score >= 75', () => {
    const { color, label } = scoreLabel(80)
    expect(color).toBe('green')
    expect(label).toBe('Strong Accumulation')
  })

  it('returns teal / Possible Accumulation for 55–74', () => {
    expect(scoreLabel(60).color).toBe('teal')
  })

  it('returns yellow / Watch for 35–54', () => {
    expect(scoreLabel(40).color).toBe('yellow')
  })

  it('returns gray / No Signal below 35', () => {
    expect(scoreLabel(20).color).toBe('gray')
    expect(scoreLabel(0).label).toBe('No Signal')
  })
})
