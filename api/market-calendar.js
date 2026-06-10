const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TradingNotes/1.0)',
  'Accept': 'application/json, text/plain, */*',
}

async function handleEarnings(req, res) {
  const { date } = req.query
  if (!date) return res.status(400).json({ message: 'date query param required (YYYY-MM-DD)' })

  const response = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, { headers: HEADERS })
  if (!response.ok) return res.status(response.status).json({ message: 'NASDAQ API error' })

  const data = await response.json()
  const earnings = (data?.data?.rows || [])
    .filter(r => r.symbol?.trim())
    .map(r => ({
      symbol: r.symbol.trim(),
      name: r.name || '',
      time: r.time || '',
      marketCap: r.marketCap || '',
      fiscalQuarterEnding: r.fiscalQuarterEnding || '',
      epsForecast: r.epsForecast || '',
      numEstimates: r.noOfEsts || '',
      lastYearEps: r.lastYearEPS || '',
      lastYearDate: r.lastYearRptDt || '',
    }))

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  res.json({ date, count: earnings.length, earnings })
}

async function handleIPOs(req, res) {
  const month = req.query.date || new Date().toISOString().slice(0, 7)

  const response = await fetch(`https://api.nasdaq.com/api/ipo/calendar?date=${month}`, { headers: HEADERS })
  if (!response.ok) return res.status(response.status).json({ message: 'NASDAQ IPO API error' })

  const data = await response.json()
  const normalise = (rows = []) =>
    rows.filter(r => r.proposedTickerSymbol || r.companyName).map(r => ({
      symbol: r.proposedTickerSymbol || '',
      name: r.companyName || '',
      exchange: r.proposedExchange || '',
      priceRange: r.proposedSharePrice || '',
      shares: r.shares || '',
      dealSize: r.dollarValueOfSharesOffered || '',
      expectedDate: r.expectedIPODate || r.pricedDate || '',
      status: r.actions?.toUpperCase() || '',
    }))

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.json({
    month,
    upcoming:  normalise(data?.data?.upcoming?.upcomingTable?.rows),
    priced:    normalise(data?.data?.priced?.rows),
    withdrawn: normalise(data?.data?.withdrawn?.rows),
    filed:     normalise(data?.data?.filed?.filedTable?.rows),
  })
}

// ─── Scanner math (inlined — serverless functions must be self-contained) ─────

function _computeRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null
  const changes = []
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1])
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]; else avgLoss -= changes[i]
  }
  avgGain /= period; avgLoss /= period
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + (changes[i] > 0 ? changes[i] : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (changes[i] < 0 ? -changes[i] : 0)) / period
  }
  if (avgLoss === 0) return 100
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 10) / 10
}

function _computeVolumeTrend(closes, volumes) {
  let downVol = 0, downDays = 0, upVol = 0, upDays = 0
  for (let i = 1; i < closes.length; i++) {
    const v = volumes[i]; if (!v || v <= 0) continue
    if (closes[i] < closes[i - 1]) { downVol += v; downDays++ }
    else if (closes[i] > closes[i - 1]) { upVol += v; upDays++ }
  }
  const avgDown = downDays > 0 ? Math.round(downVol / downDays) : 0
  const avgUp   = upDays   > 0 ? Math.round(upVol   / upDays)   : 0
  return { avgDownVol: avgDown, avgUpVol: avgUp, downDays, upDays,
           ratio: avgUp > 0 ? Math.round((avgDown / avgUp) * 100) / 100 : null }
}

function _countConsecutiveRed(closes) {
  let n = 0
  for (let i = closes.length - 1; i > 0; i--) {
    if (closes[i] < closes[i - 1]) n++; else break
  }
  return n
}

function _detectSlowGrind(closes, highs, lows, lookback = 20) {
  const n = Math.min(lookback, closes.length)
  const c = closes.slice(-n), h = highs.slice(-n), l = lows.slice(-n)
  let downDays = 0, rangeSum = 0, rangeCount = 0
  for (let i = 1; i < c.length; i++) { if (c[i] < c[i - 1]) downDays++ }
  for (let i = 0; i < c.length; i++) {
    if (h[i] && l[i] && c[i] > 0) { rangeSum += (h[i] - l[i]) / c[i]; rangeCount++ }
  }
  const downPct      = c.length > 1 ? downDays / (c.length - 1) : 0
  const avgDailyRange = rangeCount > 0 ? Math.round((rangeSum / rangeCount) * 1000) / 10 : null
  return { downDays, downPct: Math.round(downPct * 100), avgDailyRange,
           isGrinding: downPct > 0.55 && avgDailyRange != null && avgDailyRange < 3 }
}

function _computeHV(closes) {
  const slice = closes.filter(c => c != null && c > 0).slice(-31)
  if (slice.length < 2) return null
  const returns = []
  for (let j = 1; j < slice.length; j++) returns.push(Math.log(slice[j] / slice[j - 1]))
  const mean     = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100)
}

function _scoreAccumulation(signals) {
  const { rsi, volumeRatio, pctFromHigh, hv, consecutiveRed, isGrinding, insiderBuy, buyback } = signals
  let score = 0
  const breakdown = []
  if (rsi != null) {
    if      (rsi < 25) { score += 25; breakdown.push({ label: `RSI ${rsi} — extreme oversold`,  pts: 25, level: 'strong' }) }
    else if (rsi < 30) { score += 22; breakdown.push({ label: `RSI ${rsi} — very oversold`,     pts: 22, level: 'strong' }) }
    else if (rsi < 35) { score += 18; breakdown.push({ label: `RSI ${rsi} — oversold`,          pts: 18, level: 'good'   }) }
    else if (rsi < 40) { score += 10; breakdown.push({ label: `RSI ${rsi} — below neutral`,     pts: 10, level: 'mild'   }) }
    else if (rsi < 50) { score +=  3; breakdown.push({ label: `RSI ${rsi}`,                     pts:  3, level: 'weak'   }) }
    else               {              breakdown.push({ label: `RSI ${rsi} — not oversold`,       pts:  0, level: 'none'   }) }
  }
  if (volumeRatio != null) {
    const pct = Math.round(volumeRatio * 100)
    if      (volumeRatio < 0.60) { score += 25; breakdown.push({ label: `Down-day vol ${pct}% of up-day — quiet accumulation`, pts: 25, level: 'strong' }) }
    else if (volumeRatio < 0.75) { score += 18; breakdown.push({ label: `Down-day vol ${pct}% of up-day — controlled selling`,  pts: 18, level: 'good'   }) }
    else if (volumeRatio < 0.90) { score += 10; breakdown.push({ label: `Down-day vol ${pct}% of up-day — slight edge`,         pts: 10, level: 'mild'   }) }
    else                         {              breakdown.push({ label: `Down-day vol ${pct}% of up-day — no clear pattern`,     pts:  0, level: 'none'   }) }
  }
  if (pctFromHigh != null) {
    const drop = -pctFromHigh
    if      (drop >= 60) { score += 20; breakdown.push({ label: `${drop.toFixed(1)}% below 52w high — deep value`,          pts: 20, level: 'strong' }) }
    else if (drop >= 40) { score += 15; breakdown.push({ label: `${drop.toFixed(1)}% below 52w high — significant discount`, pts: 15, level: 'good'   }) }
    else if (drop >= 25) { score +=  8; breakdown.push({ label: `${drop.toFixed(1)}% below 52w high — moderate discount`,    pts:  8, level: 'mild'   }) }
    else                 {              breakdown.push({ label: `${drop.toFixed(1)}% below 52w high`,                          pts:  0, level: 'none'   }) }
  }
  if (hv != null) {
    if      (hv >= 70) { score += 15; breakdown.push({ label: `HV ${hv}% — very high, great premium`,  pts: 15, level: 'strong' }) }
    else if (hv >= 50) { score += 10; breakdown.push({ label: `HV ${hv}% — elevated, good premium`,    pts: 10, level: 'good'   }) }
    else if (hv >= 35) { score +=  5; breakdown.push({ label: `HV ${hv}% — moderate premium`,          pts:  5, level: 'mild'   }) }
    else               {              breakdown.push({ label: `HV ${hv}% — low premium environment`,    pts:  0, level: 'none'   }) }
  }
  if (isGrinding) {
    score += 10
    breakdown.push({ label: `Slow grind — ${consecutiveRed} consecutive red days, small candles`, pts: 10, level: 'good' })
  } else if (consecutiveRed >= 5) {
    score += 5; breakdown.push({ label: `${consecutiveRed} consecutive red days`, pts: 5, level: 'mild' })
  } else if (consecutiveRed >= 3) {
    score += 2; breakdown.push({ label: `${consecutiveRed} consecutive red days`, pts: 2, level: 'weak' })
  }
  if (insiderBuy && buyback) { score += 10; breakdown.push({ label: 'Insider buying + buyback program', pts: 10, level: 'strong' }) }
  else if (buyback)          { score +=  7; breakdown.push({ label: 'Share buyback program announced',  pts:  7, level: 'good'   }) }
  else if (insiderBuy)       { score +=  5; breakdown.push({ label: 'Recent insider buying (Form 4)',   pts:  5, level: 'good'   }) }
  return { score: Math.min(100, Math.round(score)), breakdown }
}

function _isoNDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

// Per-symbol accumulation scan: 1yr Yahoo OHLCV + SEC EDGAR Form 4 / 8-K
async function handleScanner(req, res) {
  const sym = (req.query.symbol || '').trim().toUpperCase()
  if (!sym) return res.status(400).json({ message: 'symbol query param required' })

  const [yahooResult, insiderResult, buybackResult] = await Promise.allSettled([
    fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`,
      { headers: HEADERS }
    ).then(r => r.json()),
    fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(sym)}%22&forms=4&dateRange=custom&startdt=${_isoNDaysAgo(90)}`,
      { headers: { ...HEADERS, Accept: 'application/json' } }
    ).then(r => r.json()),
    fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(sym)}%22+%22repurchase%22&forms=8-K&dateRange=custom&startdt=${_isoNDaysAgo(180)}`,
      { headers: { ...HEADERS, Accept: 'application/json' } }
    ).then(r => r.json()),
  ])

  const yahooData = yahooResult.status === 'fulfilled' ? yahooResult.value : null
  const chart = yahooData?.chart?.result?.[0]
  if (!chart) return res.status(404).json({ message: `No data found for ${sym}` })

  const meta    = chart.meta ?? {}
  const q       = chart.indicators?.quote?.[0] ?? {}
  const rawClose  = q.close  ?? []
  const rawHigh   = q.high   ?? []
  const rawLow    = q.low    ?? []
  const rawVolume = q.volume ?? []

  // Filter out null candles (keep index alignment)
  const valid   = rawClose.map((c, i) => c != null && c > 0 ? i : -1).filter(i => i >= 0)
  const closes  = valid.map(i => rawClose[i])
  const highs   = valid.map(i => rawHigh[i]   ?? rawClose[i])
  const lows    = valid.map(i => rawLow[i]    ?? rawClose[i])
  const volumes = valid.map(i => rawVolume[i] ?? 0)

  const price    = meta.regularMarketPrice ?? closes[closes.length - 1] ?? null
  const high52w  = highs.length > 0 ? Math.max(...highs) : null
  const low52w   = lows.length  > 0 ? Math.min(...lows.filter(l => l > 0)) : null
  const pctFromHigh = (price && high52w) ? Math.round(((price - high52w) / high52w) * 1000) / 10 : null

  const rsi            = _computeRSI(closes)
  const volTrend       = _computeVolumeTrend(closes, volumes)
  const hv             = _computeHV(closes)
  const consecutiveRed = _countConsecutiveRed(closes)
  const grind          = _detectSlowGrind(closes, highs, lows)

  const insiderBuy = insiderResult.status === 'fulfilled' && (insiderResult.value?.hits?.total?.value ?? 0) > 0
  const buyback    = buybackResult.status  === 'fulfilled' && (buybackResult.value?.hits?.total?.value  ?? 0) > 0

  const { score, breakdown } = _scoreAccumulation({
    rsi, volumeRatio: volTrend.ratio, pctFromHigh, hv,
    consecutiveRed, isGrinding: grind.isGrinding, insiderBuy, buyback,
  })

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
  res.json({
    symbol: sym, price,
    high52w: high52w ? Math.round(high52w * 100) / 100 : null,
    low52w:  low52w  ? Math.round(low52w  * 100) / 100 : null,
    pctFromHigh, rsi, hv,
    volumeTrend: volTrend, consecutiveRed, grind,
    insiderBuy, buyback,
    score, breakdown,
  })
}

// Batch-fetch current prices + 30-day historical volatility from Yahoo Finance
async function handleQuotes(req, res) {
  const symbols = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  if (!symbols.length) return res.status(400).json({ message: 'symbols query param required (comma-separated)' })

  // v8/finance/chart with 1-month daily data — no crumb required
  const results = await Promise.allSettled(
    symbols.map(sym =>
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`,
        { headers: HEADERS }
      ).then(r => r.json())
    )
  )

  const prices = {}
  for (let i = 0; i < symbols.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      const result = r.value?.chart?.result?.[0]
      if (result) {
        const meta   = result.meta ?? {}
        const price  = meta.regularMarketPrice ?? meta.previousClose ?? null
        // Calculate annualised 30-day historical volatility from daily log-returns
        const rawCloses = (result.indicators?.quote?.[0]?.close ?? []).filter(c => c != null && c > 0)
        let hv = null
        if (rawCloses.length >= 2) {
          const returns = []
          for (let j = 1; j < rawCloses.length; j++) {
            returns.push(Math.log(rawCloses[j] / rawCloses[j - 1]))
          }
          const mean = returns.reduce((s, r) => s + r, 0) / returns.length
          const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
          hv = Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100)
        }
        prices[symbols[i]] = { price, hv }
      } else {
        prices[symbols[i]] = { price: null, hv: null }
      }
    } else {
      prices[symbols[i]] = { price: null, hv: null }
    }
  }

  // Short cache — stale price is fine, don't hammer Yahoo
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  res.json({ prices })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })

  const { type } = req.query
  try {
    if (type === 'ipos')    return await handleIPOs(req, res)
    if (type === 'quotes')  return await handleQuotes(req, res)
    if (type === 'scanner') return await handleScanner(req, res)
    return await handleEarnings(req, res) // default: earnings
  } catch (error) {
    console.error('Market calendar API error:', error)
    res.status(500).json({ message: 'Failed to fetch data', error: error.message })
  }
}
