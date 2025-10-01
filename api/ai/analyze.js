import { verifyToken } from '../auth-utils.js'

// Check if user is admin
const isAdmin = (username) => {
  const adminUsername = process.env.ADMIN_USERNAME
  return username === adminUsername
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Verify authentication
    const authResult = await verifyToken(req)
    if (!authResult.success) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Check if user is admin
    if (!isAdmin(authResult.username)) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' })
    }

    const { trades, analysisType = 'general' } = req.body

    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ message: 'Trades data is required' })
    }

    // Get OpenAI API key from environment
    const openaiApiKey = process.env.TRADING_NOTES_AI
    if (!openaiApiKey) {
      return res.status(500).json({ message: 'AI service not configured' })
    }

    // Prepare trades data for analysis
    const tradesSummary = trades.map(trade => {
      const isProfitOnly = trade.trade_type === 'profit_only' || 
        (trade.shares === 1 && trade.buy_price === 0 && trade.sell_price && trade.sell_price !== 0)
      
      const isShort = trade.position_type === 'short'
      
      let profit = null
      if (isProfitOnly) {
        profit = trade.sell_price // For profit-only trades, sell_price contains the profit
      } else if (trade.sell_price && trade.sell_date) {
        // Calculate profit for regular trades
        profit = (trade.sell_price - trade.buy_price) * trade.shares
      }

      return {
        symbol: trade.symbol,
        positionType: trade.position_type || 'long',
        shares: isProfitOnly ? null : trade.shares,
        entryPrice: isShort ? trade.sell_price : trade.buy_price,
        exitPrice: isShort ? trade.buy_price : trade.sell_price,
        entryDate: isShort ? trade.sell_date : trade.buy_date,
        exitDate: isShort ? trade.buy_date : trade.sell_date,
        profit: profit,
        notes: trade.notes || '',
        isProfitOnly: isProfitOnly,
        isShort: isShort
      }
    })

    // Calculate basic statistics
    const closedTrades = tradesSummary.filter(t => t.profit !== null)
    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0)
    const winRate = closedTrades.length > 0 ? 
      (closedTrades.filter(t => t.profit > 0).length / closedTrades.length) * 100 : 0
    const avgWin = closedTrades.filter(t => t.profit > 0).length > 0 ?
      closedTrades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / 
      closedTrades.filter(t => t.profit > 0).length : 0
    const avgLoss = closedTrades.filter(t => t.profit < 0).length > 0 ?
      closedTrades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0) / 
      closedTrades.filter(t => t.profit < 0).length : 0

    // Create analysis prompt based on type
    let systemPrompt = `You are an expert trading analyst. Analyze the provided trading data and give actionable insights.`
    
    let userPrompt = `Please analyze the following trading data and provide insights:

Trading Summary:
- Total trades: ${tradesSummary.length}
- Closed trades: ${closedTrades.length}
- Total profit/loss: $${totalProfit.toFixed(2)}
- Win rate: ${winRate.toFixed(1)}%
- Average win: $${avgWin.toFixed(2)}
- Average loss: $${avgLoss.toFixed(2)}

Trade Details:
${tradesSummary.map(trade => {
  const status = trade.profit !== null ? 'Closed' : 'Open'
  const profitStr = trade.profit !== null ? `$${trade.profit.toFixed(2)}` : 'N/A'
  return `${trade.symbol} (${trade.positionType}) - ${status} - P/L: ${profitStr}${trade.notes ? ` - Notes: ${trade.notes}` : ''}`
}).join('\n')}

Please provide:
1. Overall performance assessment
2. Key strengths and weaknesses
3. Specific recommendations for improvement
4. Risk management insights
5. Any patterns you notice in the trading behavior

Keep the analysis concise but actionable (max 500 words).`

    if (analysisType === 'risk') {
      userPrompt += '\n\nFocus specifically on risk management aspects and position sizing.'
    } else if (analysisType === 'psychology') {
      userPrompt += '\n\nFocus on trading psychology and emotional patterns in the trades.'
    } else if (analysisType === 'strategy') {
      userPrompt += '\n\nFocus on trading strategy effectiveness and optimization opportunities.'
    }

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      console.error('OpenAI API Error:', errorData)
      return res.status(500).json({ 
        message: 'AI analysis failed', 
        error: 'OpenAI API error' 
      })
    }

    const openaiData = await openaiResponse.json()
    const analysis = openaiData.choices[0].message.content

    // Calculate cost (approximate)
    const inputTokens = openaiData.usage?.prompt_tokens || 0
    const outputTokens = openaiData.usage?.completion_tokens || 0
    const totalTokens = inputTokens + outputTokens
    
    // GPT-4 Turbo pricing (as of 2024): $0.01 per 1K input tokens, $0.03 per 1K output tokens
    const inputCost = (inputTokens / 1000) * 0.01
    const outputCost = (outputTokens / 1000) * 0.03
    const totalCost = inputCost + outputCost

    // Store cost data and analysis results in database
    try {
      const { Pool } = await import('pg')
      const pool = new Pool({
        connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
      })
      
      const client = await pool.connect()
      try {
        // Store cost data
        await client.query(
          'INSERT INTO ai_analysis_costs (user_id, analysis_type, input_tokens, output_tokens, total_tokens, estimated_cost) VALUES ($1, $2, $3, $4, $5, $6)',
          [authResult.userId, analysisType, inputTokens, outputTokens, totalTokens, totalCost]
        )

        // Store analysis results
        await client.query(
          'INSERT INTO ai_analysis_results (user_id, analysis_type, analysis_text, statistics, cost_data) VALUES ($1, $2, $3, $4, $5)',
          [
            authResult.userId, 
            analysisType, 
            analysis,
            JSON.stringify({
              totalTrades: tradesSummary.length,
              closedTrades: closedTrades.length,
              totalProfit: totalProfit,
              winRate: winRate,
              avgWin: avgWin,
              avgLoss: avgLoss
            }),
            JSON.stringify({
              inputTokens,
              outputTokens,
              totalTokens,
              estimatedCost: totalCost
            })
          ]
        )
      } finally {
        client.release()
      }
    } catch (dbError) {
      console.error('Failed to store analysis data:', dbError)
      // Continue even if database storage fails
    }

    // Cost tracking is handled by database storage

    res.status(200).json({
      analysis,
      statistics: {
        totalTrades: tradesSummary.length,
        closedTrades: closedTrades.length,
        totalProfit: totalProfit,
        winRate: winRate,
        avgWin: avgWin,
        avgLoss: avgLoss
      },
      cost: {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: totalCost
      }
    })

  } catch (error) {
    console.error('AI Analysis Error:', error)
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    })
  }
}
