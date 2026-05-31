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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })

  const { type } = req.query
  try {
    if (type === 'ipos') return await handleIPOs(req, res)
    return await handleEarnings(req, res) // default: earnings
  } catch (error) {
    console.error('Market calendar API error:', error)
    res.status(500).json({ message: 'Failed to fetch data', error: error.message })
  }
}
