// API Client for Vercel Functions
const API_BASE_URL = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  async request(endpoint, options = {}) {
    // Use localStorage for local development
    if (this.isLocalDev) {
      return this.localStorageRequest(endpoint, options);
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Local development using localStorage
  async localStorageRequest(endpoint, options = {}) {
    const { method = 'GET' } = options;
    
    if (endpoint === '/auth/register' && method === 'POST') {
      const { username, password } = JSON.parse(options.body);
      
      // Check if user exists
      const users = JSON.parse(localStorage.getItem('tradingUsers') || '[]');
      const existingUser = users.find(u => u.username === username);
      if (existingUser) {
        throw new Error('Username already exists');
      }
      
      // Create user
      const newUser = {
        id: Date.now(),
        username,
        password // In real app, this would be hashed
      };
      users.push(newUser);
      localStorage.setItem('tradingUsers', JSON.stringify(users));
      
      // Generate fake token
      const token = 'local-dev-token-' + Date.now();
      this.setToken(token);
      
      return {
        message: 'User created successfully',
        token,
        user: { id: newUser.id, username: newUser.username }
      };
    }
    
    if (endpoint === '/auth/login' && method === 'POST') {
      const { username, password } = JSON.parse(options.body);
      
      const users = JSON.parse(localStorage.getItem('tradingUsers') || '[]');
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      const token = 'local-dev-token-' + Date.now();
      this.setToken(token);
      
      return {
        message: 'Login successful',
        token,
        user: { id: user.id, username: user.username }
      };
    }
    
    if (endpoint === '/trades' && method === 'GET') {
      const trades = JSON.parse(localStorage.getItem('tradingTrades') || '[]');
      return trades;
    }
    
    if (endpoint === '/trades' && method === 'POST') {
      const tradeData = JSON.parse(options.body);
      const trades = JSON.parse(localStorage.getItem('tradingTrades') || '[]');
      
      const newTrade = {
        id: Date.now(),
        ...tradeData,
        created_at: new Date().toISOString()
      };
      
      trades.push(newTrade);
      localStorage.setItem('tradingTrades', JSON.stringify(trades));
      return newTrade;
    }
    
    if (endpoint.startsWith('/trades/') && method === 'PUT') {
      const tradeId = parseInt(endpoint.split('/')[2]);
      const tradeData = JSON.parse(options.body);
      const trades = JSON.parse(localStorage.getItem('tradingTrades') || '[]');
      
      const tradeIndex = trades.findIndex(t => t.id === tradeId);
      if (tradeIndex === -1) {
        throw new Error('Trade not found');
      }
      
      trades[tradeIndex] = { ...trades[tradeIndex], ...tradeData };
      localStorage.setItem('tradingTrades', JSON.stringify(trades));
      return trades[tradeIndex];
    }
    
    if (endpoint.startsWith('/trades/') && method === 'DELETE') {
      const tradeId = parseInt(endpoint.split('/')[2]);
      const trades = JSON.parse(localStorage.getItem('tradingTrades') || '[]');
      const filteredTrades = trades.filter(t => t.id !== tradeId);
      localStorage.setItem('tradingTrades', JSON.stringify(filteredTrades));
      return { message: 'Trade deleted successfully' };
    }
    
    if (endpoint === '/statistics' && method === 'GET') {
      const trades = JSON.parse(localStorage.getItem('tradingTrades') || '[]');
      const completedTrades = trades.filter(trade => trade.sellPrice && trade.sellDate);
      
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
          const profit = (trade.sellPrice - trade.buyPrice) * trade.shares;
          const volume = trade.buyPrice * trade.shares;
          return { profit, volume };
        });
        
        stats.totalProfit = profits.reduce((sum, p) => sum + p.profit, 0);
        stats.totalVolume = profits.reduce((sum, p) => sum + p.volume, 0);
        stats.winRate = (profits.filter(p => p.profit > 0).length / profits.length) * 100;
        stats.avgProfit = stats.totalProfit / profits.length;
        stats.bestTrade = Math.max(...profits.map(p => p.profit));
        stats.worstTrade = Math.min(...profits.map(p => p.profit));
      }
      
      return stats;
    }
    
    return { message: 'Not implemented for local development' };
  }

  // Authentication
  async register(username, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    return data;
  }

  // Trades
  async getTrades() {
    return this.request('/trades');
  }

  async createTrade(tradeData) {
    return this.request('/trades', {
      method: 'POST',
      body: JSON.stringify(tradeData),
    });
  }

  async updateTrade(id, tradeData) {
    return this.request(`/trades/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tradeData),
    });
  }

  async deleteTrade(id) {
    return this.request(`/trades/${id}`, {
      method: 'DELETE',
    });
  }

  // Statistics
  async getStatistics() {
    return this.request('/statistics');
  }
}

export default new ApiClient();
