export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })

  const { date } = req.query
  if (!date) return res.status(400).json({ message: 'date query param required (YYYY-MM-DD)' })

  try {
    const url = `https://api.nasdaq.com/api/calendar/earnings?date=${date}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingNotes/1.0)',
        'Accept': 'application/json, text/plain, */*',
      }
    })

    if (!response.ok) {
      return res.status(response.status).json({ message: 'NASDAQ API error', status: response.status })
    }

    const data = await response.json()
    const rows = data?.data?.rows || []

    // Normalise field names and filter out empty rows
    const earnings = rows
      .filter(r => r.symbol && r.symbol.trim())
      .map(r => ({
        symbol: r.symbol.trim(),
        name: r.name || '',
        time: r.time || '',            // 'time-pre-market' | 'time-after-hours' | ''
        marketCap: r.marketCap || '',
        fiscalQuarterEnding: r.fiscalQuarterEnding || '',
        epsForecast: r.epsForecast || '',
        numEstimates: r.noOfEsts || '',
        lastYearEps: r.lastYearEPS || '',
        lastYearDate: r.lastYearRptDt || '',
      }))

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate') // 15-min cache
    res.json({ date, count: earnings.length, earnings })
  } catch (error) {
    console.error('Earnings API error:', error)
    res.status(500).json({ message: 'Failed to fetch earnings data', error: error.message })
  }
}
