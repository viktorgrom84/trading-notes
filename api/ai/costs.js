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

  if (req.method !== 'GET') {
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

    // Fetch real cost data from database
    const { Pool } = await import('pg')
    const pool = new Pool({
      connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    })
    
    const client = await pool.connect()
    try {
      // Get current month data
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
      const monthQuery = await client.query(`
        SELECT 
          COUNT(*) as total_analyses,
          COALESCE(SUM(estimated_cost), 0) as total_cost,
          COALESCE(AVG(estimated_cost), 0) as average_cost_per_analysis
        FROM ai_analysis_costs 
        WHERE user_id = $1 
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      `, [authResult.userId])

      // Get daily usage for the last 7 days
      const dailyQuery = await client.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as analyses,
          SUM(estimated_cost) as cost
        FROM ai_analysis_costs 
        WHERE user_id = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [authResult.userId])

      const currentMonthData = monthQuery.rows[0]
      const dailyData = dailyQuery.rows

      const costData = {
        currentMonth: {
          totalAnalyses: parseInt(currentMonthData.total_analyses),
          totalCost: parseFloat(currentMonthData.total_cost),
          averageCostPerAnalysis: parseFloat(currentMonthData.average_cost_per_analysis)
        },
        dailyUsage: dailyData.map(row => ({
          date: row.date,
          analyses: parseInt(row.analyses),
          cost: parseFloat(row.cost)
        })),
        recommendations: {
          usageLimits: {
            daily: 5,
            monthly: 50,
            costLimit: 10.00
          },
          costOptimization: [
            'Use shorter prompts for simple analyses',
            'Batch multiple trade analyses together',
            'Consider using GPT-3.5-turbo for basic analyses if cost is a concern',
            'Set up usage alerts in OpenAI dashboard',
            'GPT-4 Turbo provides high-quality insights with better performance'
          ]
        },
        openaiDashboard: {
          url: 'https://platform.openai.com/usage',
          instructions: [
            'Set usage limits in OpenAI dashboard',
            'Monitor daily and monthly costs',
            'Set up billing alerts',
            'Review token usage patterns'
          ]
        }
      }

      res.status(200).json(costData)
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Cost tracking error:', error)
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    })
  }
}
