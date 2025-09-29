import { Pool } from 'pg';
import { authenticateUser, handleAuthError } from '../auth-utils.js';

const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  try {
    const user = authenticateUser(req);
    const userId = user.userId;

    const client = await pool.connect();
    
    try {
      if (req.method === 'GET') {
        const result = await client.query(
          'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
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
          [userId, symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes]
        );

        res.status(201).json(result.rows[0]);
      } else {
        res.status(405).json({ message: 'Method not allowed' });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    return handleAuthError(error, res);
  }
}