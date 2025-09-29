import { Pool } from 'pg';
import { verifyToken } from '../auth.js';

const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const client = await pool.connect();
    
    try {
      if (req.method === 'GET') {
        const result = await client.query(
          'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
          [decoded.userId]
        );
        res.json(result.rows);
      } else if (req.method === 'POST') {
        const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = req.body;

        if (!symbol || !shares || !buyPrice || !buyDate) {
          return res.status(400).json({ message: 'Symbol, shares, buy price, and buy date are required' });
        }

        const result = await client.query(
          `INSERT INTO trades (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [decoded.userId, symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes]
        );

        res.status(201).json(result.rows[0]);
      } else {
        res.status(405).json({ message: 'Method not allowed' });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Trades error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}