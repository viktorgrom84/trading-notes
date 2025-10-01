import { verifyToken } from './auth.js'

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

  try {
    console.log('AI Test endpoint called')
    
    // Verify authentication
    const authResult = await verifyToken(req)
    console.log('Auth result:', authResult)
    
    if (!authResult.success) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Check if user is admin
    if (!isAdmin(authResult.username)) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' })
    }

    // Test OpenAI API key
    const openaiApiKey = process.env.TRADING_NOTES_AI
    console.log('OpenAI key exists:', !!openaiApiKey)

    if (!openaiApiKey) {
      return res.status(500).json({ message: 'AI service not configured' })
    }

    // Simple test response
    res.status(200).json({
      message: 'AI endpoint is working',
      user: authResult.username,
      hasOpenAIKey: !!openaiApiKey,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('AI Test Error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      stack: error.stack
    })
  }
}
