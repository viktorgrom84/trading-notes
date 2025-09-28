import { createClient } from '@vercel/postgres';

// Initialize database tables
export async function initDatabase() {
  const client = createClient();
  try {
    await client.connect();
    
    // Create users table
    await client.sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create trades table
    await client.sql`
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
    `;

    console.log('Database initialized successfully');
    return { success: true, message: 'Database initialized successfully' };
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// User operations
export async function createUser(username, passwordHash) {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${passwordHash})
      RETURNING id, username, created_at
    `;
    return result.rows[0];
  } finally {
    await client.end();
  }
}

export async function getUserByUsername(username) {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.sql`
      SELECT * FROM users WHERE username = ${username}
    `;
    return result.rows[0];
  } finally {
    await client.end();
  }
}

export async function getUserById(id) {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.sql`
      SELECT id, username, created_at FROM users WHERE id = ${id}
    `;
    return result.rows[0];
  } finally {
    await client.end();
  }
}

// Trade operations
export async function getTradesByUserId(userId) {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.sql`
      SELECT * FROM trades 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return result.rows;
  } finally {
    await client.end();
  }
}

export async function createTrade(userId, tradeData) {
  const client = createClient();
  try {
    await client.connect();
    const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = tradeData;
    
    const result = await client.sql`
      INSERT INTO trades (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date, notes)
      VALUES (${userId}, ${symbol}, ${shares}, ${buyPrice}, ${buyDate}, ${sellPrice || null}, ${sellDate || null}, ${notes || null})
      RETURNING *
    `;
    return result.rows[0];
  } finally {
    await client.end();
  }
}

export async function updateTrade(tradeId, userId, tradeData) {
  const client = createClient();
  try {
    await client.connect();
    const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = tradeData;
    
    const result = await client.sql`
      UPDATE trades 
      SET symbol = ${symbol}, shares = ${shares}, buy_price = ${buyPrice}, 
          buy_date = ${buyDate}, sell_price = ${sellPrice || null}, 
          sell_date = ${sellDate || null}, notes = ${notes || null}
      WHERE id = ${tradeId} AND user_id = ${userId}
      RETURNING *
    `;
    return result.rows[0];
  } finally {
    await client.end();
  }
}

export async function deleteTrade(tradeId, userId) {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.sql`
      DELETE FROM trades 
      WHERE id = ${tradeId} AND user_id = ${userId}
      RETURNING id
    `;
    return result.rows[0];
  } finally {
    await client.end();
  }
}

export async function getTradeById(tradeId, userId) {
  const client = createClient();
  try {
    await client.connect();
    const result = await client.sql`
      SELECT * FROM trades 
      WHERE id = ${tradeId} AND user_id = ${userId}
    `;
    return result.rows[0];
  } finally {
    await client.end();
  }
}