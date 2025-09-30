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

    const userId = decoded.userId;

    const { id } = req.query;
    const client = await pool.connect();
    
    try {
      if (req.method === 'PUT') {
        const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes, profit, positionType } = req.body;

        // Check if this is a profit-only trade
        const isProfitOnlyTrade = profit !== undefined;
        
        if (isProfitOnlyTrade) {
          // Profit-only trade update
          const result = await client.query(
            `UPDATE trades SET symbol = $1, shares = $2, buy_price = $3, 
             buy_date = $4, sell_price = $5, sell_date = $6, notes = $7, position_type = $8, updated_at = CURRENT_TIMESTAMP
             WHERE id = $9 AND user_id = $10 RETURNING *`,
            [symbol, 1, 0, buyDate, profit, buyDate, notes || `Profit-only trade: ${profit > 0 ? '+' : ''}${profit}`, positionType || 'long', id, userId]
          );

          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Trade not found' });
          }

          res.json(result.rows[0]);
        } else {
          // Regular trade update
          const result = await client.query(
            `UPDATE trades SET symbol = $1, shares = $2, buy_price = $3, 
             buy_date = $4, sell_price = $5, sell_date = $6, notes = $7, position_type = $8, updated_at = CURRENT_TIMESTAMP
             WHERE id = $9 AND user_id = $10 RETURNING *`,
            [symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes, positionType || 'long', id, userId]
          );

          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Trade not found' });
          }

          res.json(result.rows[0]);
        }
      } else if (req.method === 'DELETE') {
        const result = await client.query(
          'DELETE FROM trades WHERE id = $1 AND user_id = $2 RETURNING id',
          [id, userId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Trade not found' });
        }

        res.json({ message: 'Trade deleted successfully' });
      } else {
        res.status(405).json({ message: 'Method not allowed' });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Trade operation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}
