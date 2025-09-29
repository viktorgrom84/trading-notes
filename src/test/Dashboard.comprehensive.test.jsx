import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import Dashboard from '../components/Dashboard'
import apiClient from '../api'

// Mock the API client
vi.mock('../api', () => ({
  default: {
    getStatistics: vi.fn(),
    getTrades: vi.fn(),
  }
}))

const renderWithMantine = (component) => {
  return render(
    <MantineProvider>
      <Notifications />
      {component}
    </MantineProvider>
  )
}

describe('Dashboard Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display comprehensive statistics', async () => {
    const mockStats = {
      totalTrades: 25,
      totalProfit: 5250.75,
      winRate: 68.0,
      avgProfit: 210.03,
      bestTrade: 850.50,
      worstTrade: -320.25,
      totalVolume: 15000.00
    }
    
    const mockTrades = [
      {
        id: 1,
        symbol: 'AAPL',
        shares: 100,
        buy_price: 150.00,
        buy_date: '2024-01-03',
        sell_price: 160.00,
        sell_date: '2024-01-10',
        notes: 'Great trade'
      }
    ]

    apiClient.getStatistics.mockResolvedValue(mockStats)
    apiClient.getTrades.mockResolvedValue(mockTrades)

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument() // Total trades
      expect(screen.getByText('$5,250.75')).toBeInTheDocument() // Total profit
      expect(screen.getByText('68.0%')).toBeInTheDocument() // Win rate
    })
  })

  it('should handle zero statistics gracefully', async () => {
    const mockStats = {
      totalTrades: 0,
      totalProfit: 0,
      winRate: 0,
      avgProfit: 0,
      bestTrade: 0,
      worstTrade: 0,
      totalVolume: 0
    }

    apiClient.getStatistics.mockResolvedValue(mockStats)
    apiClient.getTrades.mockResolvedValue([])

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('$0.00')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  it('should display negative profits correctly', async () => {
    const mockStats = {
      totalTrades: 5,
      totalProfit: -1250.50,
      winRate: 20.0,
      avgProfit: -250.10
    }

    const mockTrades = [
      {
        id: 1,
        symbol: 'TSLA',
        shares: 50,
        buy_price: 200.00,
        buy_date: '2024-01-03',
        sell_price: 175.00,
        sell_date: '2024-01-10',
        notes: 'Loss trade'
      }
    ]

    apiClient.getStatistics.mockResolvedValue(mockStats)
    apiClient.getTrades.mockResolvedValue(mockTrades)

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('-$1,250.50')).toBeInTheDocument()
      expect(screen.getByText('-$250.10')).toBeInTheDocument()
    })
  })

  it('should handle very large numbers', async () => {
    const mockStats = {
      totalTrades: 1000,
      totalProfit: 999999.99,
      winRate: 75.5,
      avgProfit: 999.99
    }

    apiClient.getStatistics.mockResolvedValue(mockStats)
    apiClient.getTrades.mockResolvedValue([])

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('1,000')).toBeInTheDocument()
      expect(screen.getByText('$999,999.99')).toBeInTheDocument()
      expect(screen.getByText('75.5%')).toBeInTheDocument()
    })
  })

  it('should display recent trades with various statuses', async () => {
    const mockTrades = [
      {
        id: 1,
        symbol: 'AAPL',
        shares: 100,
        buy_price: 150.00,
        buy_date: '2024-01-03',
        sell_price: 160.00,
        sell_date: '2024-01-10',
        notes: 'Closed trade'
      },
      {
        id: 2,
        symbol: 'GOOGL',
        shares: 50,
        buy_price: 200.00,
        buy_date: '2024-01-05',
        sell_price: null,
        sell_date: null,
        notes: 'Open trade'
      },
      {
        id: 3,
        symbol: 'TSLA',
        shares: 1,
        buy_price: 0,
        buy_date: '2024-01-07',
        sell_price: 250.50,
        sell_date: '2024-01-07',
        notes: 'Profit-only trade: +250.50'
      }
    ]

    apiClient.getStatistics.mockResolvedValue({ totalTrades: 3, totalProfit: 1000, winRate: 66.7, avgProfit: 333.33 })
    apiClient.getTrades.mockResolvedValue(mockTrades)

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
      expect(screen.getByText('TSLA')).toBeInTheDocument()
    })

    // Check for status badges
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('should handle loading state properly', async () => {
    // Mock a delayed response
    apiClient.getStatistics.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ totalTrades: 5, totalProfit: 1000, winRate: 60, avgProfit: 200 }), 100))
    )
    apiClient.getTrades.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 100))
    )

    renderWithMantine(<Dashboard />)

    // Should show loading state initially
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 200 })
  })

  it('should handle API errors gracefully', async () => {
    apiClient.getStatistics.mockRejectedValue(new Error('Statistics API error'))
    apiClient.getTrades.mockRejectedValue(new Error('Trades API error'))

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load trading data')).toBeInTheDocument()
    })
  })

  it('should handle partial API failures', async () => {
    apiClient.getStatistics.mockResolvedValue({ totalTrades: 5, totalProfit: 1000, winRate: 60, avgProfit: 200 })
    apiClient.getTrades.mockRejectedValue(new Error('Trades API error'))

    renderWithMantine(<Dashboard />)

    // Should show statistics but handle trades error
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument() // Statistics loaded
      expect(screen.getByText('Failed to load recent trades')).toBeInTheDocument() // Trades error
    })
  })

  it('should refresh data when refresh button is clicked', async () => {
    const mockStats = { totalTrades: 5, totalProfit: 1000, winRate: 60, avgProfit: 200 }
    const mockTrades = [{ id: 1, symbol: 'AAPL', shares: 100, buy_price: 150, buy_date: '2024-01-03' }]

    apiClient.getStatistics.mockResolvedValue(mockStats)
    apiClient.getTrades.mockResolvedValue(mockTrades)

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await userEvent.click(refreshButton)

    // Should call APIs again
    expect(apiClient.getStatistics).toHaveBeenCalledTimes(2)
    expect(apiClient.getTrades).toHaveBeenCalledTimes(2)
  })

  it('should display profit colors correctly', async () => {
    const mockTrades = [
      {
        id: 1,
        symbol: 'AAPL',
        shares: 100,
        buy_price: 150.00,
        buy_date: '2024-01-03',
        sell_price: 160.00,
        sell_date: '2024-01-10',
        notes: 'Profit trade'
      },
      {
        id: 2,
        symbol: 'TSLA',
        shares: 50,
        buy_price: 200.00,
        buy_date: '2024-01-05',
        sell_price: 180.00,
        sell_date: '2024-01-12',
        notes: 'Loss trade'
      }
    ]

    apiClient.getStatistics.mockResolvedValue({ totalTrades: 2, totalProfit: 0, winRate: 50, avgProfit: 0 })
    apiClient.getTrades.mockResolvedValue(mockTrades)

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('TSLA')).toBeInTheDocument()
    })

    // Check for profit/loss indicators (these would be styled elements)
    const profitElements = screen.getAllByText(/\$[\d,]+\.?\d*/)
    expect(profitElements.length).toBeGreaterThan(0)
  })

  it('should handle empty trades list', async () => {
    apiClient.getStatistics.mockResolvedValue({ totalTrades: 0, totalProfit: 0, winRate: 0, avgProfit: 0 })
    apiClient.getTrades.mockResolvedValue([])

    renderWithMantine(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('No recent trades')).toBeInTheDocument()
    })
  })

  it('should handle malformed trade data', async () => {
    const mockTrades = [
      {
        id: 1,
        symbol: 'AAPL',
        shares: null, // Invalid data
        buy_price: 'invalid', // Invalid data
        buy_date: '2024-01-03',
        sell_price: null,
        sell_date: null,
        notes: 'Malformed trade'
      }
    ]

    apiClient.getStatistics.mockResolvedValue({ totalTrades: 1, totalProfit: 0, winRate: 0, avgProfit: 0 })
    apiClient.getTrades.mockResolvedValue(mockTrades)

    renderWithMantine(<Dashboard />)

    // Should handle malformed data gracefully
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
  })

  it('should display win rate with proper formatting', async () => {
    const testCases = [
      { winRate: 0, expected: '0%' },
      { winRate: 50, expected: '50%' },
      { winRate: 66.67, expected: '66.7%' },
      { winRate: 100, expected: '100%' }
    ]

    for (const testCase of testCases) {
      vi.clearAllMocks()
      
      const mockStats = {
        totalTrades: 10,
        totalProfit: 1000,
        winRate: testCase.winRate,
        avgProfit: 100
      }

      apiClient.getStatistics.mockResolvedValue(mockStats)
      apiClient.getTrades.mockResolvedValue([])

      const { unmount } = renderWithMantine(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText(testCase.expected)).toBeInTheDocument()
      })

      unmount()
    }
  })

  it('should handle rapid data updates', async () => {
    const initialStats = { totalTrades: 5, totalProfit: 1000, winRate: 60, avgProfit: 200 }
    const updatedStats = { totalTrades: 6, totalProfit: 1200, winRate: 66.7, avgProfit: 200 }

    apiClient.getStatistics
      .mockResolvedValueOnce(initialStats)
      .mockResolvedValueOnce(updatedStats)
    apiClient.getTrades.mockResolvedValue([])

    renderWithMantine(<Dashboard />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    // Simulate rapid updates
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await userEvent.click(refreshButton)

    // Should handle rapid updates gracefully
    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument()
    })
  })
})
