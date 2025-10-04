import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verify JWT token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const client = await pool.connect();
    
    try {
      if (req.method === 'GET') {
        // Get all settings for user
        const result = await client.query(
          'SELECT setting_key, setting_value FROM user_settings WHERE user_id = $1',
          [userId]
        );
        
        const settings = {};
        result.rows.forEach(row => {
          settings[row.setting_key] = row.setting_value;
        });
        
        res.json(settings);
      } else if (req.method === 'POST') {
        // Set a specific setting
        const { key, value } = req.body;
        
        if (!key || value === undefined) {
          return res.status(400).json({ message: 'Key and value are required' });
        }

        await client.query(
          `INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, setting_key)
           DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
          [userId, key, value.toString()]
        );
        
        res.json({ message: 'Setting saved successfully' });
      } else {
        res.status(405).json({ message: 'Method not allowed' });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Settings API error:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Invalid token' });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
