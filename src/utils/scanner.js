/**
 * Pure math functions for the Accumulation Scanner.
 * No I/O, no React — safe to import in tests and in the API.
 *
 * Signals detected:
 *   RSI            — oversold level (Wilder's smoothing, 14-period)
 *   Volume trend   — avg volume on down-days vs up-days ratio
 *   Price drop     — distance from 52-week high
 *   Slow grind     — consecutive red days + small daily ranges
 *   HV             — 30-day annualised historical volatility
 *   SEC            — insider buying / buyback (boolean flags from API)
 */

// ─── Technical indicators ──────────────────────────────────────────────────────

/**
 * Wilder's 14-period RSI.
 * @param {number[]} closes  Array of closing prices (oldest first)
 * @param {number}   period  Default 14
 * @returns {number|null}
 */
export function computeRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null

  const changes = []
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1])
  }

  // Seed with simple average over first period
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss -= changes[i]
  }
  avgGain /= period
  avgLoss /= period

  // Wilder's smoothing for the rest
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? -changes[i] : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10
}

/**
 * Volume trend: compares average volume on down-days vs up-days.
 * ratio < 1  → selling is quieter than buying  (accumulation signal)
 * ratio > 1  → selling is louder               (distribution signal)
 *
 * @param {number[]} closes
 * @param {number[]} volumes
 * @returns {{ avgVol, avgDownVol, avgUpVol, downDays, upDays, ratio }}
 */
export function computeVolumeTrend(closes, volumes) {
  let downVolTotal = 0, downDays = 0
  let upVolTotal = 0, upDays = 0
  let totalVol = 0, totalDays = 0

  for (let i = 1; i < closes.length; i++) {
    const vol = volumes[i]
    if (vol == null || vol <= 0) continue
    totalVol += vol
    totalDays++
    if (closes[i] < closes[i - 1]) { downVolTotal += vol; downDays++ }
    else if (closes[i] > closes[i - 1]) { upVolTotal += vol; upDays++ }
  }

  const avgVol     = totalDays > 0 ? Math.round(totalVol / totalDays) : 0
  const avgDownVol = downDays > 0  ? Math.round(downVolTotal / downDays) : 0
  const avgUpVol   = upDays > 0    ? Math.round(upVolTotal / upDays) : 0
  const ratio      = avgUpVol > 0  ? Math.round((avgDownVol / avgUpVol) * 100) / 100 : null

  return { avgVol, avgDownVol, avgUpVol, downDays, upDays, ratio }
}

/**
 * Count how many consecutive sessions (from most recent) closed below the prior close.
 */
export function countConsecutiveRed(closes) {
  let count = 0
  for (let i = closes.length - 1; i > 0; i--) {
    if (closes[i] < closes[i - 1]) count++
    else break
  }
  return count
}

/**
 * Detect a "slow grind" pattern: price drifting down with small daily ranges
 * (no panic — institutions draining weak hands quietly).
 *
 * @param {number[]} closes
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number}   lookback  Rolling window (default 20 sessions)
 */
export function detectSlowGrind(closes, highs, lows, lookback = 20) {
  const n = Math.min(lookback, closes.length)
  const c = closes.slice(-n)
  const h = highs.slice(-n)
  const l = lows.slice(-n)

  let downDays = 0
  for (let i = 1; i < c.length; i++) {
    if (c[i] < c[i - 1]) downDays++
  }

  let rangeSum = 0, rangeCount = 0
  for (let i = 0; i < c.length; i++) {
    if (h[i] != null && l[i] != null && c[i] > 0) {
      rangeSum += (h[i] - l[i]) / c[i]
      rangeCount++
    }
  }

  const downPct      = c.length > 1 ? downDays / (c.length - 1) : 0
  const avgDailyRange = rangeCount > 0 ? Math.round((rangeSum / rangeCount) * 1000) / 10 : null

  // Grind = more down days than up AND small candles (avg range < 3% of price)
  const isGrinding = downPct > 0.55 && avgDailyRange != null && avgDailyRange < 3

  return {
    downDays,
    downPct:      Math.round(downPct * 100),
    avgDailyRange,
    isGrinding,
  }
}

/**
 * 30-day annualised Historical Volatility from daily log-returns.
 */
export function computeHV(closes) {
  const slice = closes.filter(c => c != null && c > 0).slice(-31)
  if (slice.length < 2) return null
  const returns = []
  for (let j = 1; j < slice.length; j++) returns.push(Math.log(slice[j] / slice[j - 1]))
  const mean     = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100)
}

// ─── Accumulation Score ────────────────────────────────────────────────────────

/**
 * Score 0–100 based on accumulation signals.
 *
 * @param {{
 *   rsi: number|null,
 *   volumeRatio: number|null,   // avgDownVol / avgUpVol
 *   pctFromHigh: number|null,   // e.g. -62.5 means 62.5% below 52w high
 *   hv: number|null,
 *   consecutiveRed: number,
 *   isGrinding: boolean,
 *   insiderBuy: boolean,
 *   buyback: boolean,
 * }} signals
 *
 * @returns {{ score: number, breakdown: Array<{label, pts, level}> }}
 */
export function computeAccumulationScore(signals) {
  const { rsi, volumeRatio, pctFromHigh, hv, consecutiveRed, isGrinding, insiderBuy, buyback } = signals
  let score = 0
  const breakdown = []

  // ── RSI (max 25 pts) ────────────────────────────────────────────────────────
  if (rsi != null) {
    if      (rsi < 25) { score += 25; breakdown.push({ label: `RSI ${rsi} — extreme oversold`,  pts: 25, level: 'strong' }) }
    else if (rsi < 30) { score += 22; breakdown.push({ label: `RSI ${rsi} — very oversold`,      pts: 22, level: 'strong' }) }
    else if (rsi < 35) { score += 18; breakdown.push({ label: `RSI ${rsi} — oversold`,            pts: 18, level: 'good'   }) }
    else if (rsi < 40) { score += 10; breakdown.push({ label: `RSI ${rsi} — below neutral`,       pts: 10, level: 'mild'   }) }
    else if (rsi < 50) { score +=  3; breakdown.push({ label: `RSI ${rsi}`,                       pts:  3, level: 'weak'   }) }
    else               {              breakdown.push({ label: `RSI ${rsi} — not oversold`,         pts:  0, level: 'none'   }) }
  }

  // ── Volume trend (max 25 pts) ────────────────────────────────────────────────
  if (volumeRatio != null) {
    const pct = Math.round(volumeRatio * 100)
    if      (volumeRatio < 0.60) { score += 25; breakdown.push({ label: `Down-day vol ${pct}% of up-day — quiet accumulation`, pts: 25, level: 'strong' }) }
    else if (volumeRatio < 0.75) { score += 18; breakdown.push({ label: `Down-day vol ${pct}% of up-day — controlled selling`,  pts: 18, level: 'good'   }) }
    else if (volumeRatio < 0.90) { score += 10; breakdown.push({ label: `Down-day vol ${pct}% of up-day — slight edge`,         pts: 10, level: 'mild'   }) }
    else                         {              breakdown.push({ label: `Down-day vol ${pct}% of up-day — no clear pattern`,     pts:  0, level: 'none'   }) }
  }

  // ── Price from 52w high (max 20 pts) ────────────────────────────────────────
  if (pctFromHigh != null) {
    const drop = -pctFromHigh
    if      (drop >= 60) { score += 20; breakdown.push({ label: `${drop.toFixed(1)}% below 52w high — deep value`,         pts: 20, level: 'strong' }) }
    else if (drop >= 40) { score += 15; breakdown.push({ label: `${drop.toFixed(1)}% below 52w high — significant discount`, pts: 15, level: 'good'   }) }
    else if (drop >= 25) { score +=  8; breakdown.push({ label: `${drop.toFixed(1)}% below 52w high — moderate discount`,    pts:  8, level: 'mild'   }) }
    else                 {              breakdown.push({ label: `${drop.toFixed(1)}% below 52w high`,                          pts:  0, level: 'none'   }) }
  }

  // ── HV (max 15 pts) ──────────────────────────────────────────────────────────
  if (hv != null) {
    if      (hv >= 70) { score += 15; breakdown.push({ label: `HV ${hv}% — very high, great premium`,    pts: 15, level: 'strong' }) }
    else if (hv >= 50) { score += 10; breakdown.push({ label: `HV ${hv}% — elevated, good premium`,       pts: 10, level: 'good'   }) }
    else if (hv >= 35) { score +=  5; breakdown.push({ label: `HV ${hv}% — moderate premium`,             pts:  5, level: 'mild'   }) }
    else               {              breakdown.push({ label: `HV ${hv}% — low premium environment`,       pts:  0, level: 'none'   }) }
  }

  // ── Slow grind (max 10 pts) ──────────────────────────────────────────────────
  if (isGrinding) {
    score += 10
    breakdown.push({ label: `Slow grind — ${consecutiveRed} consecutive red days, small candles`, pts: 10, level: 'good' })
  } else if (consecutiveRed >= 5) {
    score += 5
    breakdown.push({ label: `${consecutiveRed} consecutive red days`, pts: 5, level: 'mild' })
  } else if (consecutiveRed >= 3) {
    score += 2
    breakdown.push({ label: `${consecutiveRed} consecutive red days`, pts: 2, level: 'weak' })
  }

  // ── SEC signals (max 10 pts) ─────────────────────────────────────────────────
  if (insiderBuy && buyback) { score += 10; breakdown.push({ label: 'Insider buying + buyback program',  pts: 10, level: 'strong' }) }
  else if (buyback)          { score +=  7; breakdown.push({ label: 'Share buyback program announced',   pts:  7, level: 'good'   }) }
  else if (insiderBuy)       { score +=  5; breakdown.push({ label: 'Recent insider buying (Form 4)',    pts:  5, level: 'good'   }) }

  return { score: Math.min(100, Math.round(score)), breakdown }
}

/**
 * Map a score to a human label and Mantine color.
 */
export function scoreLabel(score) {
  if (score >= 75) return { label: 'Strong Accumulation', color: 'green'  }
  if (score >= 55) return { label: 'Possible Accumulation', color: 'teal'  }
  if (score >= 35) return { label: 'Watch', color: 'yellow' }
  return              { label: 'No Signal', color: 'gray'   }
}
