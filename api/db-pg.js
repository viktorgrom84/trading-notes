import { Pool } from 'pg';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database tables
export async function initDatabase() {
  try {
    // Test connection
    const client = await pool.connect();
    console.log('Database connected successfully');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create trades table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(10) NOT NULL,
        shares INTEGER NOT NULL,
        buy_price DECIMAL(10,2) NOT NULL,
        buy_date DATE NOT NULL,
        sell_price DECIMAL(10,2),
        sell_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    client.release();
    console.log('Database initialized successfully');
    return { success: true, message: 'Database initialized successfully' };
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// User operations
export async function createUser(username, passwordHash) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getUserByUsername(username) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getUserById(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, username, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Trade operations
export async function getTradesByUserId(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function createTrade(userId, tradeData) {
  const client = await pool.connect();
  try {
    const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = tradeData;
    
    const result = await client.query(
      `INSERT INTO trades (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, symbol, shares, buyPrice, buyDate, sellPrice || null, sellDate || null, notes || null]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateTrade(tradeId, userId, tradeData) {
  const client = await pool.connect();
  try {
    const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = tradeData;
    
    const result = await client.query(
      `UPDATE trades 
       SET symbol = $1, shares = $2, buy_price = $3, buy_date = $4, 
           sell_price = $5, sell_date = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [symbol, shares, buyPrice, buyDate, sellPrice || null, sellDate || null, notes || null, tradeId, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function deleteTrade(tradeId, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM trades WHERE id = $1 AND user_id = $2 RETURNING id',
      [tradeId, userId]
    );
    return { id: result.rows[0]?.id };
  } finally {
    client.release();
  }
}

export async function getTradeById(tradeId, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM trades WHERE id = $1 AND user_id = $2',
      [tradeId, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
