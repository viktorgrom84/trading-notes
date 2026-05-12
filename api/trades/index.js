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
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

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
      await migrateTradesSchema(client);

      if (req.method === 'GET') {
        const result = await client.query(
          'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        res.json(result.rows);

      } else if (req.method === 'POST') {
        const {
          symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes,
          profit, positionType, position_type, tradeType,
          optionType, strikePrice, expirationDate, contracts, avgPrice
        } = req.body;

        const finalPositionType = positionType || position_type || 'long';
        const finalTradeType = tradeType || (profit !== undefined ? 'profit_only' : 'regular');
        const isProfitOnlyTrade = profit !== undefined && profit !== null;
        const isOptionTrade = finalTradeType === 'option';

        if (isOptionTrade) {
          if (!symbol || !contracts || !buyPrice || !buyDate || !optionType || !strikePrice || !expirationDate) {
            return res.status(400).json({ message: 'Symbol, contracts, premium, open date, option type, strike price, and expiration date are required' });
          }
          const utcBuyDate = buyDate + 'T12:00:00.000Z';
          const utcSellDate = sellDate ? sellDate + 'T12:00:00.000Z' : null;
          const utcExpirationDate = expirationDate + 'T12:00:00.000Z';
          const result = await client.query(
            `INSERT INTO trades
               (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date,
                notes, position_type, trade_type, option_type, strike_price, expiration_date, avg_price)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [userId, symbol, contracts, buyPrice, utcBuyDate, sellPrice || null, utcSellDate,
             notes, finalPositionType, 'option', optionType, strikePrice, utcExpirationDate, avgPrice || null]
          );
          res.status(201).json(result.rows[0]);

        } else if (isProfitOnlyTrade) {
          if (!symbol || (profit === undefined || profit === null) || !buyDate) {
            return res.status(400).json({ message: 'Symbol, profit, and buy date are required for profit-only trades' });
          }
          const utcBuyDate = buyDate + 'T12:00:00.000Z';
          const result = await client.query(
            `INSERT INTO trades
               (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date,
                notes, position_type, trade_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [userId, symbol, 1, 0, utcBuyDate, profit, utcBuyDate,
             notes || `Profit-only trade: ${profit > 0 ? '+' : ''}${profit}`, finalPositionType, finalTradeType]
          );
          res.status(201).json(result.rows[0]);

        } else {
          if (!symbol || !shares || !buyPrice || !buyDate) {
            return res.status(400).json({ message: 'Symbol, shares, buy price, and buy date are required' });
          }
          const utcBuyDate = buyDate + 'T12:00:00.000Z';
          const utcSellDate = sellDate ? sellDate + 'T12:00:00.000Z' : null;
          const result = await client.query(
            `INSERT INTO trades
               (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date,
                notes, position_type, trade_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [userId, symbol, shares, buyPrice, utcBuyDate, sellPrice, utcSellDate,
             notes, finalPositionType, finalTradeType]
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
