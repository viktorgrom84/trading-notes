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
          await client.query(`
            ALTER TABLE trades 
            ADD COLUMN position_type VARCHAR(10) CHECK (position_type IN ('long', 'short'))
          `);
        } else {
          // Try to remove the default value
          try {
            await client.query(`
              ALTER TABLE trades 
              ALTER COLUMN position_type DROP DEFAULT
            `);
          } catch (error) {
            // Default value removal failed, continue
          }
        }
      } catch (error) {
        // Position type column migration failed, continue
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
          await client.query(`
            ALTER TABLE trades 
            ADD COLUMN trade_type VARCHAR(20) CHECK (trade_type IN ('regular', 'profit_only'))
          `);
        }
      } catch (error) {
        // Trade type column migration failed, continue
      }

      // Create AI analysis costs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_analysis_costs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          analysis_type VARCHAR(20) NOT NULL,
          input_tokens INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          total_tokens INTEGER NOT NULL,
          estimated_cost DECIMAL(10,6) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create AI analysis results table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_analysis_results (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          analysis_type VARCHAR(20) NOT NULL,
          analysis_text TEXT NOT NULL,
          statistics JSONB NOT NULL,
          cost_data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create user settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          setting_key VARCHAR(50) NOT NULL,
          setting_value TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, setting_key)
        );
      `);

      res.json({ message: 'Database initialized successfully' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ message: 'Database initialization failed', error: error.message });
  }
}