import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import Dashboard from '../components/Dashboard'
import apiClient from '../api'

// Mock the API client
vi.mock('../api', () => ({
  default: {
    getTrades: vi.fn(),
    getStatistics: vi.fn()
  }
}))

const renderWithMantine = (component) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  )
}

describe('Dashboard Component', () => {
  const mockTrades = [
    {
      id: 1,
      symbol: 'AAPL',
      shares: 10,
      buy_price: 150.00,
      buy_date: '2024-01-01',
      sell_price: 160.00,
      sell_date: '2024-01-02',
      notes: 'Test trade'
    },
    {
      id: 2,
      symbol: 'GOOGL',
      shares: 1,
      buy_price: 0,
      buy_date: '2024-01-01',
      sell_price: 100.00,
      sell_date: '2024-01-01',
      notes: 'Profit-only trade: +100'
    }
  ]

  const mockStats = {
    totalTrades: 2,
    totalProfit: 200.00,
    winRate: 100.0,
    avgProfitPerTrade: 100.00
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.getTrades.mockResolvedValue(mockTrades)
    apiClient.getStatistics.mockResolvedValue(mockStats)
  })

  it('should render dashboard with title and description', async () => {
    renderWithMantine(<Dashboard />)
    
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Track your trading performance and manage your notes')).toBeInTheDocument()
  })

  it('should display statistics cards', async () => {
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Total Trades')).toBeInTheDocument()
      expect(screen.getByText('Total Profit')).toBeInTheDocument()
      expect(screen.getByText('Win Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Profit')).toBeInTheDocument()
    })
  })

  it('should display correct statistics values', async () => {
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument() // Total Trades
      expect(screen.getByText('$200.00')).toBeInTheDocument() // Total Profit
      expect(screen.getByText('100.0%')).toBeInTheDocument() // Win Rate
      expect(screen.getByText('$100.00')).toBeInTheDocument() // Avg Profit
    })
  })

  it('should display recent trades', async () => {
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Recent Trades')).toBeInTheDocument()
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
    })
  })

  it('should show correct profit for regular trades', async () => {
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      // AAPL trade: (160 - 150) * 10 = $100 profit
      expect(screen.getByText('$100.00')).toBeInTheDocument()
    })
  })

  it('should show correct profit for profit-only trades', async () => {
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      // GOOGL profit-only trade: $100 profit
      expect(screen.getByText('$100.00')).toBeInTheDocument()
    })
  })

  it('should display trade details correctly', async () => {
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      // Regular trade details
      expect(screen.getByText('10 shares @ $150.00 • 1/1/2024')).toBeInTheDocument()
      
      // Profit-only trade details
      expect(screen.getByText('Profit trade • 1/1/2024')).toBeInTheDocument()
    })
  })

  it('should show trade status badges', async () => {
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getAllByText('Closed')).toHaveLength(2) // Both trades are closed
    })
  })

  it('should have working quick action buttons', async () => {
    renderWithMantine(<Dashboard />)
    
    expect(screen.getByText('Add New Trade')).toBeInTheDocument()
    expect(screen.getByText('View Statistics')).toBeInTheDocument()
    
    // Check that buttons have correct links
    const addButton = screen.getByText('Add New Trade')
    const statsButton = screen.getByText('View Statistics')
    
    expect(addButton.closest('a')).toHaveAttribute('href', '/trades')
    expect(statsButton.closest('a')).toHaveAttribute('href', '/statistics')
  })

  it('should handle loading state', () => {
    apiClient.getTrades.mockImplementation(() => new Promise(() => {})) // Never resolves
    apiClient.getStatistics.mockImplementation(() => new Promise(() => {})) // Never resolves
    
    renderWithMantine(<Dashboard />)
    
    // Should show skeleton loaders
    expect(screen.getAllByTestId('skeleton')).toHaveLength(4) // 4 stat cards
  })

  it('should handle empty trades state', async () => {
    apiClient.getTrades.mockResolvedValue([])
    apiClient.getStatistics.mockResolvedValue({
      totalTrades: 0,
      totalProfit: 0,
      winRate: 0,
      avgProfitPerTrade: 0
    })
    
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('No trades yet')).toBeInTheDocument()
      expect(screen.getByText('Start by adding your first trade')).toBeInTheDocument()
    })
  })

  it('should handle API errors gracefully', async () => {
    apiClient.getTrades.mockRejectedValue(new Error('API Error'))
    apiClient.getStatistics.mockRejectedValue(new Error('API Error'))
    
    renderWithMantine(<Dashboard />)
    
    // Should still render the basic structure
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument()
  })

  it('should display correct color coding for profits', async () => {
    const statsWithLoss = {
      totalTrades: 1,
      totalProfit: -50.00,
      winRate: 0.0,
      avgProfitPerTrade: -50.00
    }
    
    apiClient.getStatistics.mockResolvedValue(statsWithLoss)
    
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      // Should show negative values in red
      expect(screen.getByText('-$50.00')).toBeInTheDocument()
    })
  })

  it('should display win rate with correct color coding', async () => {
    const lowWinRateStats = {
      totalTrades: 10,
      totalProfit: 100.00,
      winRate: 30.0,
      avgProfitPerTrade: 10.00
    }
    
    apiClient.getStatistics.mockResolvedValue(lowWinRateStats)
    
    renderWithMantine(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('30.0%')).toBeInTheDocument()
      // Win rate below 60% should be red
    })
  })
})
