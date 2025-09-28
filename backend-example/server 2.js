// Example Node.js + Express + MongoDB Backend
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trading-notes');

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Trade Schema
const tradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  shares: { type: Number, required: true },
  buyPrice: { type: Number, required: true },
  buyDate: { type: Date, required: true },
  sellPrice: { type: Number },
  sellDate: { type: Date },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Trade = mongoose.model('Trade', tradeSchema);

// Authentication Middleware
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

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      password: hashedPassword
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, username: user.username }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all trades for a user
app.get('/api/trades', authenticateToken, async (req, res) => {
  try {
    const trades = await Trade.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new trade
app.post('/api/trades', authenticateToken, async (req, res) => {
  try {
    const tradeData = {
      ...req.body,
      userId: req.user.userId
    };

    const trade = new Trade(tradeData);
    await trade.save();

    res.status(201).json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a trade
app.put('/api/trades/:id', authenticateToken, async (req, res) => {
  try {
    const trade = await Trade.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      req.body,
      { new: true }
    );

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    res.json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a trade
app.delete('/api/trades/:id', authenticateToken, async (req, res) => {
  try {
    const trade = await Trade.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    res.json({ message: 'Trade deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get trading statistics
app.get('/api/statistics', authenticateToken, async (req, res) => {
  try {
    const trades = await Trade.find({ userId: req.user.userId });
    const completedTrades = trades.filter(trade => trade.sellPrice && trade.sellDate);

    const stats = {
      totalTrades: completedTrades.length,
      totalProfit: 0,
      winRate: 0,
      avgProfit: 0,
      bestTrade: 0,
      worstTrade: 0
    };

    if (completedTrades.length > 0) {
      const profits = completedTrades.map(trade => 
        (trade.sellPrice - trade.buyPrice) * trade.shares
      );

      stats.totalProfit = profits.reduce((sum, profit) => sum + profit, 0);
      stats.winRate = (profits.filter(p => p > 0).length / profits.length) * 100;
      stats.avgProfit = stats.totalProfit / profits.length;
      stats.bestTrade = Math.max(...profits);
      stats.worstTrade = Math.min(...profits);
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
