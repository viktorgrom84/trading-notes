import { describe, it, expect, beforeEach, vi } from 'vitest'
import apiClient from '../api'

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Authentication', () => {
    it('should register a new user', async () => {
      const mockResponse = {
        message: 'User created successfully',
        token: 'mock-token',
        user: { id: 1, username: 'testuser' }
      }
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await apiClient.register('testuser', 'password123')
      
      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' })
      })
      expect(result).toEqual(mockResponse)
    })

    it('should login a user', async () => {
      const mockResponse = {
        message: 'Login successful',
        token: 'mock-token',
        user: { id: 1, username: 'testuser' }
      }
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await apiClient.login('testuser', 'password123')
      
      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' })
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle login errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid credentials' })
      })

      await expect(apiClient.login('testuser', 'wrongpassword')).rejects.toThrow('Invalid credentials')
    })
  })

  describe('Trades', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'mock-token')
    })

    it('should get all trades', async () => {
      const mockTrades = [
        { id: 1, symbol: 'AAPL', shares: 10, buy_price: 150.00, buy_date: '2024-01-01' }
      ]
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTrades)
      })

      const result = await apiClient.getTrades()
      
      expect(fetch).toHaveBeenCalledWith('/api/trades', {
        headers: { 'Authorization': 'Bearer mock-token' }
      })
      expect(result).toEqual(mockTrades)
    })

    it('should create a regular trade', async () => {
      const tradeData = {
        symbol: 'AAPL',
        shares: 10,
        buyPrice: 150.00,
        buyDate: '2024-01-01',
        sellPrice: 160.00,
        sellDate: '2024-01-02',
        notes: 'Test trade'
      }
      
      const mockResponse = { id: 1, ...tradeData }
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await apiClient.createTrade(tradeData)
      
      expect(fetch).toHaveBeenCalledWith('/api/trades', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(tradeData)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should create a profit-only trade', async () => {
      const tradeData = {
        symbol: 'AAPL',
        profit: 100.00,
        buyDate: '2024-01-01',
        notes: 'Profit trade'
      }
      
      const mockResponse = { id: 1, ...tradeData }
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await apiClient.createTrade(tradeData)
      
      expect(fetch).toHaveBeenCalledWith('/api/trades', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(tradeData)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should update a trade', async () => {
      const tradeId = 1
      const updateData = { symbol: 'GOOGL', shares: 5 }
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: tradeId, ...updateData })
      })

      const result = await apiClient.updateTrade(tradeId, updateData)
      
      expect(fetch).toHaveBeenCalledWith(`/api/trades/${tradeId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(updateData)
      })
      expect(result).toEqual({ id: tradeId, ...updateData })
    })

    it('should delete a trade', async () => {
      const tradeId = 1
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Trade deleted successfully' })
      })

      const result = await apiClient.deleteTrade(tradeId)
      
      expect(fetch).toHaveBeenCalledWith(`/api/trades/${tradeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer mock-token' }
      })
      expect(result).toEqual({ message: 'Trade deleted successfully' })
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'mock-token')
    })

    it('should get trading statistics', async () => {
      const mockStats = {
        totalTrades: 10,
        totalProfit: 500.00,
        winRate: 70.0,
        avgProfitPerTrade: 50.00
      }
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })

      const result = await apiClient.getStatistics()
      
      expect(fetch).toHaveBeenCalledWith('/api/statistics', {
        headers: { 'Authorization': 'Bearer mock-token' }
      })
      expect(result).toEqual(mockStats)
    })
  })

  describe('Admin', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'mock-token')
    })

    it('should get all users (admin only)', async () => {
      const mockUsers = [
        { id: 1, username: 'user1', created_at: '2024-01-01' },
        { id: 2, username: 'user2', created_at: '2024-01-02' }
      ]
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers)
      })

      const result = await apiClient.getUsers()
      
      expect(fetch).toHaveBeenCalledWith('/admin-users', {
        headers: { 'Authorization': 'Bearer mock-token' }
      })
      expect(result).toEqual(mockUsers)
    })

    it('should delete a user (admin only)', async () => {
      const userId = 2
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'User deleted successfully' })
      })

      const result = await apiClient.deleteUser(userId)
      
      expect(fetch).toHaveBeenCalledWith('/admin-users?id=2', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer mock-token' }
      })
      expect(result).toEqual({ message: 'User deleted successfully' })
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(apiClient.getTrades()).rejects.toThrow('Network error')
    })

    it('should handle API errors with status codes', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' })
      })

      await expect(apiClient.getTrades()).rejects.toThrow('Server error')
    })

    it('should handle unauthorized access', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' })
      })

      await expect(apiClient.getTrades()).rejects.toThrow('Unauthorized')
    })
  })
})
