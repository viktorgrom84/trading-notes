import './config.js';
import { sql } from '@vercel/postgres';

// Initialize database tables
export async function initDatabase() {
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create trades table
    await sql`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// User operations
export async function createUser(username, passwordHash) {
  const result = await sql`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    RETURNING id, username, created_at
  `;
  return result.rows[0];
}

export async function getUserByUsername(username) {
  const result = await sql`
    SELECT * FROM users WHERE username = ${username}
  `;
  return result.rows[0];
}

export async function getUserById(id) {
  const result = await sql`
    SELECT id, username, created_at FROM users WHERE id = ${id}
  `;
  return result.rows[0];
}

// Trade operations
export async function getTradesByUserId(userId) {
  const result = await sql`
    SELECT * FROM trades 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function createTrade(userId, tradeData) {
  const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = tradeData;
  
  const result = await sql`
    INSERT INTO trades (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date, notes)
    VALUES (${userId}, ${symbol}, ${shares}, ${buyPrice}, ${buyDate}, ${sellPrice || null}, ${sellDate || null}, ${notes || null})
    RETURNING *
  `;
  return result.rows[0];
}

export async function updateTrade(tradeId, userId, tradeData) {
  const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = tradeData;
  
  const result = await sql`
    UPDATE trades 
    SET symbol = ${symbol}, shares = ${shares}, buy_price = ${buyPrice}, 
        buy_date = ${buyDate}, sell_price = ${sellPrice || null}, 
        sell_date = ${sellDate || null}, notes = ${notes || null}
    WHERE id = ${tradeId} AND user_id = ${userId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function deleteTrade(tradeId, userId) {
  const result = await sql`
    DELETE FROM trades 
    WHERE id = ${tradeId} AND user_id = ${userId}
    RETURNING id
  `;
  return result.rows[0];
}

export async function getTradeById(tradeId, userId) {
  const result = await sql`
    SELECT * FROM trades 
    WHERE id = ${tradeId} AND user_id = ${userId}
  `;
  return result.rows[0];
}
