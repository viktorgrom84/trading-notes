import { Pool } from 'pg';
import { verifyToken } from './auth.js';

const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
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
      const result = await client.query(
        'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      const trades = result.rows;
      const completedTrades = trades.filter(trade => trade.sell_price && trade.sell_date);
      const openTrades = trades.filter(trade => !trade.sell_price || !trade.sell_date);

      let totalProfit = 0;
      let totalInvested = 0;
      let winningTrades = 0;
      let losingTrades = 0;

      completedTrades.forEach(trade => {
        // Check if this is a profit-only trade
        const isProfitOnlyTrade = trade.shares === 1 && trade.buy_price === 0 && 
                                 trade.buy_date === trade.sell_date && 
                                 trade.notes && trade.notes.includes('Profit-only trade');
        
        let profit;
        let buyValue;
        
        if (isProfitOnlyTrade) {
          // For profit-only trades, the profit is stored in sell_price
          profit = trade.sell_price;
          buyValue = 0; // No investment for profit-only trades
        } else {
          // Regular trade calculation
          buyValue = trade.buy_price * trade.shares;
          const sellValue = trade.sell_price * trade.shares;
          profit = sellValue - buyValue;
        }
        
        totalInvested += buyValue;
        totalProfit += profit;
        
        if (profit > 0) {
          winningTrades++;
        } else if (profit < 0) {
          losingTrades++;
        }
      });

      const winRate = completedTrades.length > 0 ? (winningTrades / completedTrades.length) * 100 : 0;
      const avgProfitPerTrade = completedTrades.length > 0 ? totalProfit / completedTrades.length : 0;
      const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

      res.json({
        totalTrades: trades.length,
        completedTrades: completedTrades.length,
        openTrades: openTrades.length,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalInvested: Math.round(totalInvested * 100) / 100,
        winningTrades,
        losingTrades,
        winRate: Math.round(winRate * 100) / 100,
        avgProfitPerTrade: Math.round(avgProfitPerTrade * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        recentTrades: trades.slice(0, 5)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}