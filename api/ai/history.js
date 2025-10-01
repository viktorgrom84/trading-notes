import { verifyToken } from '../auth-utils.js'

// Check if user is admin
const isAdmin = (username) => {
  const adminUsername = process.env.ADMIN_USERNAME
  return username === adminUsername
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
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

    // Fetch analysis history from database
    const { Pool } = await import('pg')
    const pool = new Pool({
      connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    })
    
    const client = await pool.connect()
    try {
      const query = await client.query(`
        SELECT 
          id,
          analysis_type,
          analysis_text,
          statistics,
          cost_data,
          created_at
        FROM ai_analysis_results 
        WHERE user_id = $1 
        ORDER BY created_at DESC
        LIMIT 50
      `, [authResult.userId])

      const analysisHistory = query.rows.map(row => ({
        id: row.id,
        analysisType: row.analysis_type,
        analysisText: row.analysis_text,
        statistics: row.statistics,
        costData: row.cost_data,
        createdAt: row.created_at
      }))

      res.status(200).json({ analysisHistory })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Analysis history error:', error)
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    })
  }
}
