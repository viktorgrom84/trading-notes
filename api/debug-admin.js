import { verifyToken } from './auth-utils.js'

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
    
    res.json({
      adminUsername: process.env.ADMIN_USERNAME,
      hasEnvVar: !!process.env.ADMIN_USERNAME,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
