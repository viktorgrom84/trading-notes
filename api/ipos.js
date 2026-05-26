export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })

  // date param is YYYY-MM; default to current month
  const { date } = req.query
  const month = date || new Date().toISOString().slice(0, 7)

  try {
    const url = `https://api.nasdaq.com/api/ipo/calendar?date=${month}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingNotes/1.0)',
        'Accept': 'application/json, text/plain, */*',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ message: 'NASDAQ IPO API error', status: response.status })
    }

    const data = await response.json()

    const normalise = (rows = []) =>
      rows
        .filter(r => r.proposedTickerSymbol || r.companyName)
        .map(r => ({
          symbol: r.proposedTickerSymbol || '',
          name: r.companyName || '',
          exchange: r.proposedExchange || '',
          priceRange: r.proposedSharePrice || '',
          shares: r.shares || '',
          dealSize: r.dollarValueOfSharesOffered || '',
          expectedDate: r.expectedIPODate || r.pricedDate || '',
          status: r.actions?.toUpperCase() || '',
        }))

    const upcoming  = normalise(data?.data?.upcoming?.upcomingTable?.rows)
    const priced    = normalise(data?.data?.priced?.rows)
    const withdrawn = normalise(data?.data?.withdrawn?.rows)
    const filed     = normalise(data?.data?.filed?.filedTable?.rows)

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate') // 1-hr cache
    res.json({ month, upcoming, priced, withdrawn, filed })
  } catch (error) {
    console.error('IPO API error:', error)
    res.status(500).json({ message: 'Failed to fetch IPO data', error: error.message })
  }
}
