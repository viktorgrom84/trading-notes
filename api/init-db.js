import { Pool } from 'pg';

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
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

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
          position_type VARCHAR(10) DEFAULT 'long' CHECK (position_type IN ('long', 'short')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add position_type column if it doesn't exist (migration)
      try {
        // First check if column exists
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'trades' AND column_name = 'position_type'
        `);
        
        if (columnCheck.rows.length === 0) {
          console.log('Adding position_type column...');
          await client.query(`
            ALTER TABLE trades 
            ADD COLUMN position_type VARCHAR(10) CHECK (position_type IN ('long', 'short'))
          `);
          console.log('✅ position_type column added successfully');
        } else {
          console.log('ℹ️ position_type column already exists, updating default value...');
          // Try to remove the default value
          try {
            await client.query(`
              ALTER TABLE trades 
              ALTER COLUMN position_type DROP DEFAULT
            `);
            console.log('✅ Removed default value from position_type column');
          } catch (error) {
            console.log('ℹ️ Could not remove default value:', error.message);
          }
        }
      } catch (error) {
        console.log('❌ Error with position_type column:', error.message);
      }

      // Add trade_type column if it doesn't exist (migration)
      try {
        // First check if column exists
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'trades' AND column_name = 'trade_type'
        `);
        
        if (columnCheck.rows.length === 0) {
          console.log('Adding trade_type column...');
          await client.query(`
            ALTER TABLE trades 
            ADD COLUMN trade_type VARCHAR(20) CHECK (trade_type IN ('regular', 'profit_only'))
          `);
          console.log('✅ trade_type column added successfully');
        } else {
          console.log('ℹ️ trade_type column already exists');
        }
      } catch (error) {
        console.log('❌ Error with trade_type column:', error.message);
      }

      res.json({ message: 'Database initialized successfully' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ message: 'Database initialization failed', error: error.message });
  }
}