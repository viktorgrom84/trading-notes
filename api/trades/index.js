import { Pool } from 'pg';
import { verifyToken } from '../auth.js';

const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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

    const client = await pool.connect();
    
    try {
      if (req.method === 'GET') {
        const result = await client.query(
          'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        res.json(result.rows);
      } else if (req.method === 'POST') {
        const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes, profit, positionType, position_type, tradeType } = req.body;
        const finalPositionType = positionType || position_type || 'long';
        const finalTradeType = tradeType || (profit !== undefined ? 'profit_only' : 'regular');


        // Check if this is a profit-only trade (profit field exists, even if 0)
        const isProfitOnlyTrade = profit !== undefined && profit !== null;
        
        if (isProfitOnlyTrade) {
          // Profit-only trade validation
          if (!symbol || (profit === undefined || profit === null) || !buyDate) {
            return res.status(400).json({ message: 'Symbol, profit, and buy date are required for profit-only trades' });
          }
          
          // Store the exact date selected by user (no timezone conversion)
          const utcBuyDate = buyDate + 'T00:00:00.000Z'
          
          // For profit-only trades, store profit as sell_price with dummy values
          const result = await client.query(
            `INSERT INTO trades (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date, notes, position_type, trade_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [userId, symbol, 1, 0, utcBuyDate, profit, utcBuyDate, notes || `Profit-only trade: ${profit > 0 ? '+' : ''}${profit}`, finalPositionType, finalTradeType]
          );
          
          res.status(201).json(result.rows[0]);
        } else {
          // Regular trade validation
          if (!symbol || !shares || !buyPrice || !buyDate) {
            return res.status(400).json({ message: 'Symbol, shares, buy price, and buy date are required' });
          }

          // Store the exact dates selected by user (no timezone conversion)
          const utcBuyDate = buyDate + 'T00:00:00.000Z'
          const utcSellDate = sellDate ? sellDate + 'T00:00:00.000Z' : null

          const result = await client.query(
            `INSERT INTO trades (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date, notes, position_type, trade_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [userId, symbol, shares, buyPrice, utcBuyDate, sellPrice, utcSellDate, notes, finalPositionType, finalTradeType]
          );

          res.status(201).json(result.rows[0]);
        }
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