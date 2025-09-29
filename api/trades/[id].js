import { getTradeById, updateTrade, deleteTrade } from '../db-prisma.js';
import { verifyToken, getTokenFromRequest } from '../auth.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
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

    const { id } = req.query;
    const tradeId = parseInt(id);

    if (req.method === 'GET') {
      // Get specific trade
      const trade = await getTradeById(tradeId, decoded.userId);
      if (!trade) {
        return res.status(404).json({ message: 'Trade not found' });
      }
      res.json(trade);
    } else if (req.method === 'PUT') {
      // Update trade
      const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = req.body;

      // Validate required fields
      if (!symbol || !shares || !buyPrice || !buyDate) {
        return res.status(400).json({ message: 'Symbol, shares, buy price, and buy date are required' });
      }

      const trade = await updateTrade(tradeId, decoded.userId, {
        symbol,
        shares: parseInt(shares),
        buyPrice: parseFloat(buyPrice),
        buyDate,
        sellPrice: sellPrice ? parseFloat(sellPrice) : null,
        sellDate: sellDate || null,
        notes: notes || null
      });

      if (!trade) {
        return res.status(404).json({ message: 'Trade not found' });
      }

      res.json(trade);
    } else if (req.method === 'DELETE') {
      // Delete trade
      const result = await deleteTrade(tradeId, decoded.userId);
      if (!result) {
        return res.status(404).json({ message: 'Trade not found' });
      }
      res.json({ message: 'Trade deleted successfully' });
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Trade API error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
