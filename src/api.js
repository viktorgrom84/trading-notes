// API Client for Vercel Functions
const API_BASE_URL = '/api';

class ApiClient {
  constructor() {
    this.token = null;
    this.initializeToken();
  }

  initializeToken() {
    try {
      this.token = localStorage.getItem('authToken');
    } catch (error) {
      // Handle case where localStorage is not available (e.g., in tests)
      this.token = null;
    }
  }

  setToken(token) {
    this.token = token;
    try {
      localStorage.setItem('authToken', token);
    } catch (error) {
      // Handle case where localStorage is not available (e.g., in tests)
      console.warn('localStorage not available:', error);
    }
  }

  clearToken() {
    this.token = null;
    try {
      localStorage.removeItem('authToken');
    } catch (error) {
      // Handle case where localStorage is not available (e.g., in tests)
      console.warn('localStorage not available:', error);
    }
  }

  async request(endpoint, options = {}) {
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

  // Admin
  async getUsers() {
    return this.request('/admin-users');
  }

  async deleteUser(id) {
    return this.request(`/admin-users?id=${id}`, {
      method: 'DELETE',
    });
  }

  // AI Analysis
  async analyzeTrades(trades, analysisType = 'general') {
    return this.request('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ trades, analysisType }),
    });
  }

  async getCostData() {
    return this.request('/ai/costs');
  }

  async getAnalysisHistory() {
    return this.request('/ai/history');
  }
}

export default new ApiClient();
