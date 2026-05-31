export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })

  try {
    // Fetch the monthly table from multpl.com
    const response = await fetch('https://www.multpl.com/shiller-pe/table/by-month', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.multpl.com/',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ message: 'Failed to fetch CAPE data', status: response.status })
    }

    const html = await response.text()

    // Parse table rows — value cell contains &#x2002; whitespace before the number
    const rowRegex = /<tr[^>]*>\s*<td[^>]*>([A-Za-z]+ \d{1,2}, \d{4})<\/td>\s*<td[^>]*>[\s\S]*?([\d.]+)\s*<\/td>\s*<\/tr>/g
    const history = []
    let match

    while ((match = rowRegex.exec(html)) !== null) {
      const dateStr = match[1].trim()
      const value = parseFloat(match[2])
      if (!isNaN(value)) {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
          history.push({
            date: d.toISOString().slice(0, 7), // YYYY-MM
            value,
          })
        }
      }
    }

    // Sort ascending by date
    history.sort((a, b) => a.date.localeCompare(b.date))

    const current = history.length > 0 ? history[history.length - 1] : null

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate') // 24-hr cache
    res.json({
      current,
      history, // full history back to 1881
      historicalAverage: 17.0,
      longTermAverage: 16.8,
    })
  } catch (error) {
    console.error('Market indicators API error:', error)
    res.status(500).json({ message: 'Failed to fetch market indicators', error: error.message })
  }
}
