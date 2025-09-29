// Local API server for development
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database
async function initDatabase() {
  try {
    const client = await pool.connect();
    
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
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Initialize database
app.post('/api/init-db', async (req, res) => {
  try {
    await initDatabase();
    res.json({ message: 'Database initialized successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Database initialization failed', error: error.message });
  }
});

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const client = await pool.connect();
    const existingUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (existingUser.rows.length > 0) {
      client.release();
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await client.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, hashedPassword]
    );

    client.release();

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.rows[0].id, username: result.rows[0].username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: result.rows[0].id, username: result.rows[0].username }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const client = await pool.connect();
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      client.release();
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      client.release();
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    client.release();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get trades
app.get('/api/trades', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create trade
app.post('/api/trades', authenticateToken, async (req, res) => {
  try {
    const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = req.body;
    
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO trades (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.userId, symbol, shares, buyPrice, buyDate, sellPrice || null, sellDate || null, notes || null]
    );
    client.release();
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create trade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update trade
app.put('/api/trades/:id', authenticateToken, async (req, res) => {
  try {
    const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = req.body;
    const tradeId = req.params.id;
    
    const client = await pool.connect();
    const result = await client.query(
      `UPDATE trades 
       SET symbol = $1, shares = $2, buy_price = $3, buy_date = $4, 
           sell_price = $5, sell_date = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [symbol, shares, buyPrice, buyDate, sellPrice || null, sellDate || null, notes || null, tradeId, req.user.userId]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update trade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete trade
app.delete('/api/trades/:id', authenticateToken, async (req, res) => {
  try {
    const tradeId = req.params.id;
    
    const client = await pool.connect();
    const result = await client.query(
      'DELETE FROM trades WHERE id = $1 AND user_id = $2 RETURNING id',
      [tradeId, req.user.userId]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    
    res.json({ message: 'Trade deleted successfully' });
  } catch (error) {
    console.error('Delete trade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin endpoints
const ADMIN_USERNAME = 'viktorgrom84@gmail.com';

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    console.log("🚀 ~ req.user:", req.user)
    // Check if user is admin
    if (req.user.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.username !== ADMIN_USERNAME) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, username',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        message: 'User deleted successfully', 
        deletedUser: result.rows[0] 
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get statistics
app.get('/api/statistics', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM trades WHERE user_id = $1',
      [req.user.userId]
    );
    client.release();
    
    const trades = result.rows;
    const completedTrades = trades.filter(trade => trade.sell_price && trade.sell_date);
    
    const stats = {
      totalTrades: completedTrades.length,
      totalProfit: 0,
      winRate: 0,
      avgProfit: 0,
      bestTrade: 0,
      worstTrade: 0,
      totalVolume: 0
    };
    
    if (completedTrades.length > 0) {
      const profits = completedTrades.map(trade => {
        const profit = (trade.sell_price - trade.buy_price) * trade.shares;
        const volume = trade.buy_price * trade.shares;
        return { profit, volume };
      });
      
      stats.totalProfit = profits.reduce((sum, p) => sum + p.profit, 0);
      stats.totalVolume = profits.reduce((sum, p) => sum + p.volume, 0);
      stats.winRate = (profits.filter(p => p.profit > 0).length / profits.length) * 100;
      stats.avgProfit = stats.totalProfit / profits.length;
      stats.bestTrade = Math.max(...profits.map(p => p.profit));
      stats.worstTrade = Math.min(...profits.map(p => p.profit));
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Local API server running on http://localhost:${PORT}`);
  console.log(`   POST http://localhost:${PORT}/api/init-db`);
  console.log(`   POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   GET  http://localhost:${PORT}/api/trades`);
  console.log(`   POST http://localhost:${PORT}/api/trades`);
  console.log(`   PUT  http://localhost:${PORT}/api/trades/:id`);
  console.log(`   DELETE http://localhost:${PORT}/api/trades/:id`);
  console.log(`   GET  http://localhost:${PORT}/api/statistics`);
  console.log(`   GET  http://localhost:${PORT}/api/admin/users (Admin only)`);
  console.log(`   DELETE http://localhost:${PORT}/api/admin/users/:id (Admin only)`);
  
  // Initialize database
  try {
    await initDatabase();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
});
