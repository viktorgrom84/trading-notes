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
    const url = `https://api.nasdaq.com/api/calendar/economicevents?date=${date}`
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

    const events = rows
      .filter(r => r.eventName && r.eventName.trim())
      .map(r => ({
        gmt: r.gmt || '',
        country: r.country || '',
        eventName: r.eventName.trim(),
        actual: r.actual?.trim() || null,
        consensus: r.consensus?.trim() || null,
        previous: r.previous?.trim() || null,
        description: r.description
          ? r.description.replace(/<[^>]+>/g, '').trim()   // strip HTML tags
          : '',
      }))

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    res.json({ date, count: events.length, events })
  } catch (error) {
    console.error('Economic events API error:', error)
    res.status(500).json({ message: 'Failed to fetch economic events', error: error.message })
  }
}
