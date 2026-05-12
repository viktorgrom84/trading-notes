import { Pool } from 'pg';
import { verifyToken } from '../auth.js';

const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const OPTION_COLUMNS = [
  { name: 'position_type',   def: "VARCHAR(10)" },
  { name: 'trade_type',      def: "VARCHAR(20)" },
  { name: 'option_type',     def: "VARCHAR(4)" },
  { name: 'strike_price',    def: "DECIMAL(10,2)" },
  { name: 'expiration_date', def: "DATE" },
  { name: 'avg_price',       def: "DECIMAL(10,2)" },
];

async function migrateTradesSchema(client) {
  for (const { name, def } of OPTION_COLUMNS) {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'trades' AND column_name = $1`,
      [name]
    );
    if (rows.length === 0) {
      await client.query(`ALTER TABLE trades ADD COLUMN ${name} ${def}`);
    }
  }
}

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
      await migrateTradesSchema(client);

      if (req.method === 'PUT') {
        const {
          symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes,
          profit, positionType, tradeType,
          optionType, strikePrice, expirationDate, contracts, avgPrice
        } = req.body;

        const isProfitOnlyTrade = profit !== undefined;
        const isOptionTrade = tradeType === 'option';

        if (isOptionTrade) {
          const utcBuyDate = buyDate + 'T12:00:00.000Z';
          const utcSellDate = sellDate ? sellDate + 'T12:00:00.000Z' : null;
          const utcExpirationDate = expirationDate + 'T12:00:00.000Z';
          const result = await client.query(
            `UPDATE trades SET
               symbol = $1, shares = $2, buy_price = $3, buy_date = $4,
               sell_price = $5, sell_date = $6, notes = $7, position_type = $8,
               trade_type = $9, option_type = $10, strike_price = $11,
               expiration_date = $12, avg_price = $13, updated_at = CURRENT_TIMESTAMP
             WHERE id = $14 AND user_id = $15 RETURNING *`,
            [symbol, contracts, buyPrice, utcBuyDate, sellPrice || null, utcSellDate,
             notes, positionType || 'short', 'option', optionType, strikePrice,
             utcExpirationDate, avgPrice || null, id, userId]
          );
          if (result.rows.length === 0) return res.status(404).json({ message: 'Trade not found' });
          res.json(result.rows[0]);

        } else if (isProfitOnlyTrade) {
          const utcBuyDate = buyDate + 'T12:00:00.000Z';
          const result = await client.query(
            `UPDATE trades SET
               symbol = $1, shares = $2, buy_price = $3, buy_date = $4,
               sell_price = $5, sell_date = $6, notes = $7, position_type = $8,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $9 AND user_id = $10 RETURNING *`,
            [symbol, 1, 0, utcBuyDate, profit, utcBuyDate,
             notes || `Profit-only trade: ${profit > 0 ? '+' : ''}${profit}`,
             positionType || 'long', id, userId]
          );
          if (result.rows.length === 0) return res.status(404).json({ message: 'Trade not found' });
          res.json(result.rows[0]);

        } else {
          const utcBuyDate = buyDate + 'T12:00:00.000Z';
          const utcSellDate = sellDate ? sellDate + 'T12:00:00.000Z' : null;
          const result = await client.query(
            `UPDATE trades SET
               symbol = $1, shares = $2, buy_price = $3, buy_date = $4,
               sell_price = $5, sell_date = $6, notes = $7, position_type = $8,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $9 AND user_id = $10 RETURNING *`,
            [symbol, shares, buyPrice, utcBuyDate, sellPrice, utcSellDate,
             notes, positionType || 'long', id, userId]
          );
          if (result.rows.length === 0) return res.status(404).json({ message: 'Trade not found' });
          res.json(result.rows[0]);
        }

      } else if (req.method === 'DELETE') {
        const result = await client.query(
          'DELETE FROM trades WHERE id = $1 AND user_id = $2 RETURNING id',
          [id, userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Trade not found' });
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
