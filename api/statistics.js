import { Pool } from 'pg';
import { authenticateUser, handleAuthError } from './auth-utils.js';

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
    const user = authenticateUser(req);
    const userId = user.userId;

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
    return handleAuthError(error, res);
  }
}