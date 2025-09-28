import { getTradesByUserId } from './db.js';
import { verifyToken, getTokenFromRequest } from './auth.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const token = getTokenFromRequest(req);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or missing token' });
    }

    // Get all trades for user
    const trades = await getTradesByUserId(decoded.userId);
    const completedTrades = trades.filter(trade => trade.sell_price && trade.sell_date);

    const stats = {
      totalTrades: completedTrades.length,
      totalProfit: 0,
      winRate: 0,
      avgProfit: 0,
      bestTrade: 0,
      worstTrade: 0,
      totalVolume: 0
    };

    if (completedTrades.length > 0) {
      const profits = completedTrades.map(trade => {
        const profit = (trade.sell_price - trade.buy_price) * trade.shares;
        const volume = trade.buy_price * trade.shares;
        return { profit, volume };
      });

      stats.totalProfit = profits.reduce((sum, p) => sum + p.profit, 0);
      stats.totalVolume = profits.reduce((sum, p) => sum + p.volume, 0);
      stats.winRate = (profits.filter(p => p.profit > 0).length / profits.length) * 100;
      stats.avgProfit = stats.totalProfit / profits.length;
      stats.bestTrade = Math.max(...profits.map(p => p.profit));
      stats.worstTrade = Math.min(...profits.map(p => p.profit));
    }

    res.json(stats);
  } catch (error) {
    console.error('Statistics API error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
