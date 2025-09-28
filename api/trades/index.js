import '../config.js';
import { getTradesByUserId, createTrade } from '../db.js';
import { verifyToken, getTokenFromRequest } from '../auth.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verify authentication
    const token = getTokenFromRequest(req);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or missing token' });
    }

    if (req.method === 'GET') {
      // Get all trades for user
      const trades = await getTradesByUserId(decoded.userId);
      res.json(trades);
    } else if (req.method === 'POST') {
      // Create new trade
      const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = req.body;

      // Validate required fields
      if (!symbol || !shares || !buyPrice || !buyDate) {
        return res.status(400).json({ message: 'Symbol, shares, buy price, and buy date are required' });
      }

      const trade = await createTrade(decoded.userId, {
        symbol,
        shares: parseInt(shares),
        buyPrice: parseFloat(buyPrice),
        buyDate,
        sellPrice: sellPrice ? parseFloat(sellPrice) : null,
        sellDate: sellDate || null,
        notes: notes || null
      });

      res.status(201).json(trade);
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Trades API error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
