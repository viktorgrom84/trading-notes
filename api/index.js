import { Pool } from 'pg';
import { hashPassword, comparePassword, generateToken, verifyToken } from './auth.js';

// Create connection pool for Vercel
const pool = new Pool({
  connectionString: process.env.viktor_POSTGRES_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const ADMIN_USERNAME = 'admin@test.com';

export default async function handler(req, res) {
  const { method, url } = req;
  
  // Parse the URL to get the endpoint
  const path = url.split('?')[0];
  
  try {
    // Route to appropriate handler based on path
    if (path === '/api/init-db') {
      return await handleInitDb(req, res);
    } else if (path === '/api/auth/register') {
      return await handleRegister(req, res);
    } else if (path === '/api/auth/login') {
      return await handleLogin(req, res);
    } else if (path === '/api/trades') {
      return await handleTrades(req, res);
    } else if (path.startsWith('/api/trades/')) {
      return await handleTradeById(req, res);
    } else if (path === '/api/statistics') {
      return await handleStatistics(req, res);
    } else if (path === '/api/admin/users') {
      return await handleAdminUsers(req, res);
    } else if (path.startsWith('/api/admin/users/')) {
      return await handleAdminDeleteUser(req, res);
    } else {
      return res.status(404).json({ message: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// Initialize database
async function handleInitDb(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    res.json({ message: 'Database initialized successfully' });
  } finally {
    client.release();
  }
}

// User registration
async function handleRegister(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ message: 'Username must be at least 3 characters long' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  const client = await pool.connect();
  try {
    // Check if user already exists
    const existingUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const result = await client.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.username);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user.id, username: user.username }
    });
  } finally {
    client.release();
  }
}

// User login
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.username);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username }
    });
  } finally {
    client.release();
  }
}

// Trades CRUD
async function handleTrades(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      const result = await client.query(
        'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
        [decoded.userId]
      );
      res.json(result.rows);
    } else if (req.method === 'POST') {
      const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = req.body;

      if (!symbol || !shares || !buyPrice || !buyDate) {
        return res.status(400).json({ message: 'Symbol, shares, buy price, and buy date are required' });
      }

      const result = await client.query(
        `INSERT INTO trades (user_id, symbol, shares, buy_price, buy_date, sell_price, sell_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [decoded.userId, symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes]
      );

      res.status(201).json(result.rows[0]);
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } finally {
    client.release();
  }
}

// Trade by ID (update/delete)
async function handleTradeById(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const { id } = req.query;
  const client = await pool.connect();
  
  try {
    if (req.method === 'PUT') {
      const { symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes } = req.body;

      const result = await client.query(
        `UPDATE trades SET symbol = $1, shares = $2, buy_price = $3, 
         buy_date = $4, sell_price = $5, sell_date = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 AND user_id = $9 RETURNING *`,
        [symbol, shares, buyPrice, buyDate, sellPrice, sellDate, notes, id, decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Trade not found' });
      }

      res.json(result.rows[0]);
    } else if (req.method === 'DELETE') {
      const result = await client.query(
        'DELETE FROM trades WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Trade not found' });
      }

      res.json({ message: 'Trade deleted successfully' });
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } finally {
    client.release();
  }
}

// Statistics
async function handleStatistics(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
      [decoded.userId]
    );

    const trades = result.rows;
    const completedTrades = trades.filter(trade => trade.sell_price && trade.sell_date);
    const openTrades = trades.filter(trade => !trade.sell_price || !trade.sell_date);

    let totalProfit = 0;
    let totalInvested = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    completedTrades.forEach(trade => {
      const buyValue = trade.buy_price * trade.shares;
      const sellValue = trade.sell_price * trade.shares;
      const profit = sellValue - buyValue;
      
      totalInvested += buyValue;
      totalProfit += profit;
      
      if (profit > 0) {
        winningTrades++;
      } else if (profit < 0) {
        losingTrades++;
      }
    });

    const winRate = completedTrades.length > 0 ? (winningTrades / completedTrades.length) * 100 : 0;
    const avgProfitPerTrade = completedTrades.length > 0 ? totalProfit / completedTrades.length : 0;
    const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    res.json({
      totalTrades: trades.length,
      completedTrades: completedTrades.length,
      openTrades: openTrades.length,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
      winningTrades,
      losingTrades,
      winRate: Math.round(winRate * 100) / 100,
      avgProfitPerTrade: Math.round(avgProfitPerTrade * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      recentTrades: trades.slice(0, 5)
    });
  } finally {
    client.release();
  }
}

// Admin - Get users
async function handleAdminUsers(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (decoded.username !== ADMIN_USERNAME) {
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
}

// Admin - Delete user
async function handleAdminDeleteUser(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (decoded.username !== ADMIN_USERNAME) {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }

  const { id } = req.query;
  
  if (parseInt(id) === decoded.userId) {
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
}
