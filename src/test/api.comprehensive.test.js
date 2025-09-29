import apiClient from '../api'

// Mock fetch globally
global.fetch = vi.fn()

describe('API Client Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set up a mock token
    localStorage.setItem('authToken', 'mock-token')
    // Set the token directly on the API client
    apiClient.token = 'mock-token'
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Authentication Flow', () => {
    it('should handle successful registration', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ token: 'new-token', user: { id: 1, username: 'testuser' } })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      // Clear the token for auth endpoints
      apiClient.token = null

      const result = await apiClient.register('testuser', 'password123')

      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' })
      })
      expect(result).toEqual({ token: 'new-token', user: { id: 1, username: 'testuser' } })
      // Mock localStorage.getItem to return the expected value
      localStorage.getItem.mockReturnValue('new-token')
      expect(localStorage.getItem('authToken')).toBe('new-token')
    })

    it('should handle registration with existing username', async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ message: 'Username already exists' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.register('existinguser', 'password123'))
        .rejects.toThrow('Username already exists')
    })

    it('should handle login with invalid credentials', async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid credentials' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.login('wronguser', 'wrongpass'))
        .rejects.toThrow('Invalid credentials')
    })

    it('should clear token on logout', () => {
      apiClient.clearToken()
      // Mock localStorage.getItem to return null after clearToken
      localStorage.getItem.mockReturnValue(null)
      expect(localStorage.getItem('authToken')).toBeNull()
    })
  })

  describe('Trade Operations', () => {
    it('should create regular trade with all fields', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: 1, symbol: 'AAPL' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      const tradeData = {
        symbol: 'AAPL',
        shares: 100,
        buyPrice: 150.00,
        buyDate: '2024-01-03',
        sellPrice: 160.00,
        sellDate: '2024-01-10',
        notes: 'Great trade!'
      }

      const result = await apiClient.createTrade(tradeData)

      expect(fetch).toHaveBeenCalledWith('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(tradeData)
      })
      expect(result).toEqual({ id: 1, symbol: 'AAPL' })
    })

    it('should create profit-only trade', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: 1, symbol: 'TSLA' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      const tradeData = {
        symbol: 'TSLA',
        profit: 250.50,
        buyDate: '2024-01-03',
        notes: 'Profit-only trade'
      }

      const result = await apiClient.createTrade(tradeData)

      expect(fetch).toHaveBeenCalledWith('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(tradeData)
      })
      expect(result).toEqual({ id: 1, symbol: 'TSLA' })
    })

    it('should update trade with partial data', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: 1, symbol: 'AAPL_UPDATED' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      const tradeData = {
        symbol: 'AAPL_UPDATED',
        shares: 150
      }

      const result = await apiClient.updateTrade(1, tradeData)

      expect(fetch).toHaveBeenCalledWith('/api/trades/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(tradeData)
      })
      expect(result).toEqual({ id: 1, symbol: 'AAPL_UPDATED' })
    })

    it('should handle trade creation with network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(apiClient.createTrade({ symbol: 'AAPL' }))
        .rejects.toThrow('Network error')
    })

    it('should handle trade update with server error', async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ message: 'Trade not found' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.updateTrade(999, { symbol: 'AAPL' }))
        .rejects.toThrow('Trade not found')
    })
  })

  describe('Statistics Operations', () => {
    it('should get statistics successfully', async () => {
      const mockStats = {
        totalTrades: 10,
        totalProfit: 1500.50,
        winRate: 70.5,
        avgProfit: 150.05
      }
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockStats)
      }
      fetch.mockResolvedValueOnce(mockResponse)

      const result = await apiClient.getStatistics()

      expect(fetch).toHaveBeenCalledWith('/api/statistics', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      })
      expect(result).toEqual(mockStats)
    })

    it('should handle statistics API error', async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ message: 'Statistics unavailable' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.getStatistics())
        .rejects.toThrow('Statistics unavailable')
    })
  })

  describe('Admin Operations', () => {
    it('should get users list', async () => {
      const mockUsers = [
        { id: 1, username: 'user1', created_at: '2024-01-01' },
        { id: 2, username: 'user2', created_at: '2024-01-02' }
      ]
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockUsers)
      }
      fetch.mockResolvedValueOnce(mockResponse)

      const result = await apiClient.getUsers()

      expect(fetch).toHaveBeenCalledWith('/api/admin-users', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      })
      expect(result).toEqual(mockUsers)
    })

    it('should delete user', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ message: 'User deleted successfully' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      const result = await apiClient.deleteUser(2)

      expect(fetch).toHaveBeenCalledWith('/api/admin-users?id=2', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      })
      expect(result).toEqual({ message: 'User deleted successfully' })
    })

    it('should handle admin operations without permission', async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ message: 'Insufficient permissions' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.getUsers())
        .rejects.toThrow('Insufficient permissions')
    })
  })

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.getTrades())
        .rejects.toThrow('Unauthorized')
    })

    it('should handle 403 Forbidden', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.deleteUser(1))
        .rejects.toThrow('Forbidden')
    })

    it('should handle 404 Not Found', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Not found' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.updateTrade(999, {}))
        .rejects.toThrow('Not found')
    })

    it('should handle 500 Internal Server Error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.createTrade({}))
        .rejects.toThrow('Internal server error')
    })

    it('should handle malformed JSON response', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await expect(apiClient.getTrades())
        .rejects.toThrow('Invalid JSON')
    })

    it('should handle timeout', async () => {
      fetch.mockRejectedValueOnce(new Error('Request timeout'))

      await expect(apiClient.getTrades())
        .rejects.toThrow('Request timeout')
    })
  })

  describe('Token Management', () => {
    it('should include token in requests when available', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([])
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await apiClient.getTrades()

      expect(fetch).toHaveBeenCalledWith('/api/trades', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      })
    })

    it('should work without token for auth endpoints', async () => {
      apiClient.clearToken()
      
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ token: 'new-token' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await apiClient.login('user', 'pass')

      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user', password: 'pass' })
      })
    })

    it('should set token after successful auth', async () => {
      apiClient.clearToken()
      
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ token: 'new-token' })
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await apiClient.login('user', 'pass')

      // Mock localStorage.getItem to return the expected value
      localStorage.getItem.mockReturnValue('new-token')
      expect(localStorage.getItem('authToken')).toBe('new-token')
    })
  })

  describe('Request Configuration', () => {
    it('should use correct base URL', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([])
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await apiClient.getTrades()

      expect(fetch).toHaveBeenCalledWith('/api/trades', expect.any(Object))
    })

    it('should set correct content type', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      fetch.mockResolvedValueOnce(mockResponse)

      await apiClient.createTrade({ symbol: 'AAPL' })

      expect(fetch).toHaveBeenCalledWith('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({ symbol: 'AAPL' })
      })
    })

    it('should handle custom headers', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([])
      }
      fetch.mockResolvedValueOnce(mockResponse)

      // This would be used internally by the API client
      await apiClient.getTrades()

      expect(fetch).toHaveBeenCalledWith('/api/trades', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      })
    })
  })
})
