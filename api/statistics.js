import { Pool } from 'pg';
import { verifyToken } from './auth.js';

/** Returns { year, month (0-indexed) } from a pg DATE value (Date object or ISO string). */
function parseDateYearMonth(dateValue) {
  if (!dateValue) return null;
  // pg returns DATE as a Date object (midnight UTC) or as an ISO "YYYY-MM-DD" string
  const iso = dateValue instanceof Date ? dateValue.toISOString() : String(dateValue);
  const parts = iso.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { year: parts[0], month: parts[1] - 1 };
}

function tradeProfit(trade) {
  const isProfitOnlyTrade =
    trade.trade_type === 'profit_only' ||
    (trade.shares === 1 &&
      Number(trade.buy_price) === 0 &&
      trade.buy_date === trade.sell_date &&
      trade.notes &&
      trade.notes.includes('Profit-only trade'));

  if (isProfitOnlyTrade) {
    return Number(trade.sell_price);
  }

  if (trade.trade_type === 'option') {
    const premium = Number(trade.buy_price);
    if (trade.sell_price != null && trade.sell_date) {
      const closePrice = Number(trade.sell_price);
      return trade.position_type === 'short'
        ? premium - closePrice
        : closePrice - premium;
    }
    // Open option: premium collected (short) or paid (long)
    return trade.position_type === 'short' ? premium : -premium;
  }

  const buyValue = Number(trade.buy_price) * Number(trade.shares);
  const sellValue = Number(trade.sell_price) * Number(trade.shares);
  return sellValue - buyValue;
}

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
      const completedTrades = trades.filter(trade => {
        if (trade.trade_type === 'profit_only') return true;
        if (trade.trade_type === 'option') return trade.sell_date || trade.position_type === 'short';
        return trade.sell_price && trade.sell_date;
      });
      const openTrades = trades.filter(trade => {
        if (trade.trade_type === 'option') return false;
        return !trade.sell_price || !trade.sell_date;
      });

      let totalProfit = 0;
      let totalInvested = 0;
      let winningTrades = 0;
      let losingTrades = 0;

      const nowYear = new Date().getUTCFullYear();
      const nowMonth = new Date().getUTCMonth();
      let performanceThisMonth = 0;
      let performanceThisYear = 0;

      completedTrades.forEach(trade => {
        const profit = tradeProfit(trade);
        const isProfitOnlyTrade =
          trade.trade_type === 'profit_only' ||
          (trade.shares === 1 &&
            Number(trade.buy_price) === 0 &&
            trade.notes &&
            trade.notes.includes('Profit-only trade'));
        const buyValue = isProfitOnlyTrade ? 0 : Number(trade.buy_price) * Number(trade.shares);

        totalInvested += buyValue;
        totalProfit += profit;

        // Options: count premium on buy_date; others: count on sell_date
        const dateForPerf = trade.trade_type === 'option' ? trade.buy_date : trade.sell_date;
        const exitDate = parseDateYearMonth(dateForPerf);
        if (exitDate) {
          if (exitDate.year === nowYear && exitDate.month === nowMonth) {
            performanceThisMonth += profit;
          }
          if (exitDate.year === nowYear) {
            performanceThisYear += profit;
          }
        }

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
        performanceThisMonth: Math.round(performanceThisMonth * 100) / 100,
        performanceThisYear: Math.round(performanceThisYear * 100) / 100,
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