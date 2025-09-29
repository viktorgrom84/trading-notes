import { Pool } from 'pg';

// Create connection pool for Vercel
const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const client = await pool.connect();
    
    try {
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
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
        );
      `);

      console.log('Database initialized successfully');
      res.json({ message: 'Database initialized successfully' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ message: 'Database initialization failed', error: error.message });
  }
}