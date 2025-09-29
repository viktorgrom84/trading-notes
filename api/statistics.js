import { Pool } from 'pg';
import { verifyToken } from './auth.js';

// Create connection pool for Vercel
const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify authentication
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
      // Get all trades for user
      const result = await client.query(
        'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
        [decoded.userId]
      );

      const trades = result.rows;

      // Calculate statistics
      const totalTrades = trades.length;
      const completedTrades = trades.filter(trade => trade.sell_price && trade.sell_date);
      const openTrades = trades.filter(trade => !trade.sell_price || !trade.sell_date);

      // Calculate profit/loss for completed trades
      let totalProfit = 0;
      let totalInvested = 0;
      let winningTrades = 0;
      let losingTrades = 0;

      completedTrades.forEach(trade => {
        const buyValue = trade.buy_price * trade.shares;
        const sellValue = trade.sell_price * trade.shares;
        const profit = sellValue - buyValue;
        
        totalInvested += buyValue;
        totalProfit += profit;
        
        if (profit > 0) {
          winningTrades++;
        } else if (profit < 0) {
          losingTrades++;
        }
      });

      // Calculate win rate
      const winRate = completedTrades.length > 0 ? (winningTrades / completedTrades.length) * 100 : 0;

      // Calculate average profit per trade
      const avgProfitPerTrade = completedTrades.length > 0 ? totalProfit / completedTrades.length : 0;

      // Calculate return on investment
      const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

      // Get recent trades (last 5)
      const recentTrades = trades.slice(0, 5);

      // Calculate monthly performance
      const monthlyData = {};
      trades.forEach(trade => {
        if (trade.sell_date) {
          const month = new Date(trade.sell_date).toISOString().substring(0, 7); // YYYY-MM
          if (!monthlyData[month]) {
            monthlyData[month] = { profit: 0, trades: 0 };
          }
          const profit = (trade.sell_price - trade.buy_price) * trade.shares;
          monthlyData[month].profit += profit;
          monthlyData[month].trades += 1;
        }
      });

      const monthlyPerformance = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          profit: data.profit,
          trades: data.trades
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      res.json({
        totalTrades,
        completedTrades: completedTrades.length,
        openTrades: openTrades.length,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalInvested: Math.round(totalInvested * 100) / 100,
        winningTrades,
        losingTrades,
        winRate: Math.round(winRate * 100) / 100,
        avgProfitPerTrade: Math.round(avgProfitPerTrade * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        recentTrades,
        monthlyPerformance
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}