import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import TradingNotes from '../components/TradingNotes'
import apiClient from '../api'

// Mock the API client
vi.mock('../api', () => ({
  default: {
    getTrades: vi.fn(),
    createTrade: vi.fn(),
    updateTrade: vi.fn(),
    deleteTrade: vi.fn(),
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

describe('TradingNotes Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should complete full workflow: create, edit, and delete trades', async () => {
    const user = userEvent.setup()
    
    // Mock initial empty state
    apiClient.getTrades.mockResolvedValueOnce([])
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'AAPL' })
    
    renderWithMantine(<TradingNotes />)
    
    // 1. Create a regular trade
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Verify trade was created
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'AAPL',
        shares: 100,
        buyPrice: 150.00,
        buyDate: '2024-01-03',
        sellPrice: null,
        sellDate: null,
        notes: null
      })
    })
    
    // Mock updated trades list
    const mockTrade = {
      id: 1,
      symbol: 'AAPL',
      shares: 100,
      buy_price: 150.00,
      buy_date: '2024-01-03',
      sell_price: null,
      sell_date: null,
      notes: null
    }
    apiClient.getTrades.mockResolvedValueOnce([mockTrade])
    apiClient.updateTrade.mockResolvedValue({ id: 1, symbol: 'AAPL_UPDATED' })
    
    // 2. Edit the trade
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)
    
    await user.clear(screen.getByLabelText('Symbol'))
    await user.type(screen.getByLabelText('Symbol'), 'AAPL_UPDATED')
    await user.clear(screen.getByLabelText('Shares'))
    await user.type(screen.getByLabelText('Shares'), '150')
    
    const updateButton = screen.getByText('Update Trade')
    await user.click(updateButton)
    
    // Verify trade was updated
    await waitFor(() => {
      expect(apiClient.updateTrade).toHaveBeenCalledWith(1, {
        symbol: 'AAPL_UPDATED',
        shares: 150,
        buyPrice: 150.00,
        buyDate: '2024-01-03',
        sellPrice: null,
        sellDate: null,
        notes: null
      })
    })
    
    // Mock updated trades list after edit
    const updatedTrade = { ...mockTrade, symbol: 'AAPL_UPDATED', shares: 150 }
    apiClient.getTrades.mockResolvedValueOnce([updatedTrade])
    apiClient.deleteTrade.mockResolvedValue({ message: 'Deleted' })
    
    // 3. Delete the trade
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    await user.click(deleteButton)
    
    // Verify trade was deleted
    await waitFor(() => {
      expect(apiClient.deleteTrade).toHaveBeenCalledWith(1)
    })
  })

  it('should complete profit-only trade workflow', async () => {
    const user = userEvent.setup()
    
    apiClient.getTrades.mockResolvedValueOnce([])
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'TSLA' })
    
    renderWithMantine(<TradingNotes />)
    
    // 1. Create a profit-only trade
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Switch to profit-only mode
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    await user.type(screen.getByLabelText('Symbol'), 'TSLA')
    await user.type(screen.getByLabelText('Profit/Loss'), '250.50')
    await user.type(screen.getByLabelText('Trade Date'), '2024-01-03')
    await user.type(screen.getByLabelText('Notes'), 'Great trade!')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Verify profit-only trade was created
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'TSLA',
        profit: 250.50,
        buyDate: '2024-01-03',
        notes: 'Great trade!'
      })
    })
  })

  it('should handle mixed regular and profit-only trades', async () => {
    const user = userEvent.setup()
    
    // Mock trades with both types
    const mockTrades = [
      {
        id: 1,
        symbol: 'AAPL',
        shares: 100,
        buy_price: 150.00,
        buy_date: '2024-01-03',
        sell_price: 160.00,
        sell_date: '2024-01-10',
        notes: 'Regular trade'
      },
      {
        id: 2,
        symbol: 'TSLA',
        shares: 1,
        buy_price: 0,
        buy_date: '2024-01-05',
        sell_price: 250.50,
        sell_date: '2024-01-05',
        notes: 'Profit-only trade: +250.50'
      }
    ]
    
    apiClient.getTrades.mockResolvedValueOnce(mockTrades)
    
    renderWithMantine(<TradingNotes />)
    
    // Wait for trades to load
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('TSLA')).toBeInTheDocument()
    })
    
    // Verify both trades are displayed correctly
    expect(screen.getByText('100')).toBeInTheDocument() // AAPL shares
    expect(screen.getByText('$150.00')).toBeInTheDocument() // AAPL buy price
    expect(screen.getByText('$160.00')).toBeInTheDocument() // AAPL sell price
    
    // TSLA should show dashes for irrelevant fields
    const rows = screen.getAllByRole('row')
    const tslaRow = rows.find(row => row.textContent.includes('TSLA'))
    expect(tslaRow).toHaveTextContent('-') // For shares, buy price, sell price, sell date
  })

  it('should handle search and filter functionality', async () => {
    const user = userEvent.setup()
    
    const mockTrades = [
      {
        id: 1,
        symbol: 'AAPL',
        shares: 100,
        buy_price: 150.00,
        buy_date: '2024-01-03',
        sell_price: 160.00,
        sell_date: '2024-01-10',
        notes: 'Apple stock'
      },
      {
        id: 2,
        symbol: 'GOOGL',
        shares: 50,
        buy_price: 200.00,
        buy_date: '2024-01-05',
        sell_price: null,
        sell_date: null,
        notes: 'Google stock'
      },
      {
        id: 3,
        symbol: 'MSFT',
        shares: 75,
        buy_price: 300.00,
        buy_date: '2024-01-07',
        sell_price: 310.00,
        sell_date: '2024-01-15',
        notes: 'Microsoft stock'
      }
    ]
    
    apiClient.getTrades.mockResolvedValueOnce(mockTrades)
    
    renderWithMantine(<TradingNotes />)
    
    // Wait for trades to load
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
      expect(screen.getByText('MSFT')).toBeInTheDocument()
    })
    
    // Test search functionality
    const searchInput = screen.getByPlaceholderText('Search by symbol or notes...')
    await user.type(searchInput, 'AAPL')
    
    // Should only show AAPL
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('GOOGL')).not.toBeInTheDocument()
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
    
    // Clear search
    await user.clear(searchInput)
    
    // Test filter functionality - show only open positions
    const filterButton = screen.getByText('Filter: All Trades')
    await user.click(filterButton)
    
    const openFilter = screen.getByText('Open Positions')
    await user.click(openFilter)
    
    // Should only show GOOGL (open position)
    expect(screen.getByText('GOOGL')).toBeInTheDocument()
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
  })

  it('should handle form validation and error recovery', async () => {
    const user = userEvent.setup()
    
    apiClient.getTrades.mockResolvedValue([])
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'AAPL' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Try to submit empty form
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Should show validation errors
    expect(screen.getByText('Symbol is required')).toBeInTheDocument()
    expect(screen.getByText('Shares must be greater than 0')).toBeInTheDocument()
    expect(screen.getByText('Buy price must be greater than 0')).toBeInTheDocument()
    expect(screen.getByText('Buy date is required')).toBeInTheDocument()
    
    // Fill in form correctly
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    // Validation errors should be gone
    expect(screen.queryByText('Symbol is required')).not.toBeInTheDocument()
    expect(screen.queryByText('Shares must be greater than 0')).not.toBeInTheDocument()
    expect(screen.queryByText('Buy price must be greater than 0')).not.toBeInTheDocument()
    expect(screen.queryByText('Buy date is required')).not.toBeInTheDocument()
    
    // Submit should work now
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalled()
    })
  })

  it('should handle mode switching during form editing', async () => {
    const user = userEvent.setup()
    
    const mockTrade = {
      id: 1,
      symbol: 'AAPL',
      shares: 100,
      buy_price: 150.00,
      buy_date: '2024-01-03',
      sell_price: null,
      sell_date: null,
      notes: 'Regular trade'
    }
    
    apiClient.getTrades.mockResolvedValueOnce([mockTrade])
    apiClient.updateTrade.mockResolvedValue({ id: 1, symbol: 'AAPL' })
    
    renderWithMantine(<TradingNotes />)
    
    // Wait for trade to load
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
    
    // Edit the trade
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)
    
    // Switch to profit-only mode while editing
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    // Form should reset and show profit-only fields
    expect(screen.getByLabelText('Symbol')).toHaveValue('')
    expect(screen.queryByLabelText('Shares')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buy Price')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Trade Date')).toHaveValue('')
    
    // Fill in profit-only form
    await user.type(screen.getByLabelText('Symbol'), 'TSLA')
    await user.type(screen.getByLabelText('Profit/Loss'), '250.50')
    await user.type(screen.getByLabelText('Trade Date'), '2024-01-05')
    
    const updateButton = screen.getByText('Update Trade')
    await user.click(updateButton)
    
    // Should create profit-only trade
    await waitFor(() => {
      expect(apiClient.updateTrade).toHaveBeenCalledWith(1, {
        symbol: 'TSLA',
        profit: 250.50,
        buyDate: '2024-01-05',
        notes: null
      })
    })
  })
})
