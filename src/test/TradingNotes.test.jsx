import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import TradingNotes from '../components/TradingNotes'
import apiClient from '../api'

// Mock the API client
vi.mock('../api', () => ({
  default: {
    getTrades: vi.fn(),
    createTrade: vi.fn(),
    updateTrade: vi.fn(),
    deleteTrade: vi.fn()
  }
}))

// Mock notifications
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn()
  }
}))

const renderWithMantine = (component) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  )
}

describe('TradingNotes Component', () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.getTrades.mockResolvedValue(mockTrades)
  })

  it('should render trading notes page', async () => {
    renderWithMantine(<TradingNotes />)
    
    expect(screen.getByText('Trading Notes')).toBeInTheDocument()
    expect(screen.getByText('Manage your trading positions and track performance')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
    })
  })

  it('should display trades in table', async () => {
    renderWithMantine(<TradingNotes />)
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('$150.00')).toBeInTheDocument()
      expect(screen.getByText('$160.00')).toBeInTheDocument()
    })
  })

  it('should open add trade modal when clicking Add Trade button', async () => {
    const user = userEvent.setup()
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    expect(screen.getByText('Add New Trade')).toBeInTheDocument()
    expect(screen.getByText('Regular Trade')).toBeInTheDocument()
    expect(screen.getByText('Profit Only')).toBeInTheDocument()
  })

  it('should switch between regular and profit-only modes', async () => {
    const user = userEvent.setup()
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Should show regular trade fields by default
    expect(screen.getByLabelText('Shares')).toBeInTheDocument()
    expect(screen.getByLabelText('Buy Price')).toBeInTheDocument()
    
    // Switch to profit-only mode
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    // Should show profit-only fields
    expect(screen.getByLabelText('Profit/Loss')).toBeInTheDocument()
    expect(screen.queryByLabelText('Shares')).not.toBeInTheDocument()
  })

  it('should create a regular trade', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 3, symbol: 'MSFT' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in regular trade form
    await user.type(screen.getByLabelText('Symbol'), 'MSFT')
    await user.type(screen.getByLabelText('Shares'), '5')
    await user.type(screen.getByLabelText('Buy Price'), '300')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'MSFT',
        shares: 5,
        buyPrice: 300,
        buyDate: '2024-01-03',
        sellPrice: '',
        sellDate: '',
        notes: ''
      })
    })
  })

  it('should create a profit-only trade', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 3, symbol: 'TSLA' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Switch to profit-only mode
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    // Fill in profit-only form
    await user.type(screen.getByLabelText('Symbol'), 'TSLA')
    await user.type(screen.getByLabelText('Profit/Loss'), '250')
    await user.type(screen.getByLabelText('Trade Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'TSLA',
        profit: 250,
        buyDate: '2024-01-03',
        notes: null
      })
    })
  })

  it('should edit an existing trade', async () => {
    const user = userEvent.setup()
    apiClient.updateTrade.mockResolvedValue({ id: 1, symbol: 'AAPL_UPDATED' })
    
    renderWithMantine(<TradingNotes />)
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
    
    // Click edit button for first trade
    const editButtons = screen.getAllByLabelText('Edit')
    await user.click(editButtons[0])
    
    expect(screen.getByText('Edit Trade')).toBeInTheDocument()
    expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument()
    
    // Update the symbol
    const symbolInput = screen.getByDisplayValue('AAPL')
    await user.clear(symbolInput)
    await user.type(symbolInput, 'AAPL_UPDATED')
    
    const updateButton = screen.getByText('Update Trade')
    await user.click(updateButton)
    
    await waitFor(() => {
      expect(apiClient.updateTrade).toHaveBeenCalledWith(1, expect.objectContaining({
        symbol: 'AAPL_UPDATED'
      }))
    })
  })

  it('should delete a trade', async () => {
    const user = userEvent.setup()
    apiClient.deleteTrade.mockResolvedValue({ message: 'Trade deleted successfully' })
    
    renderWithMantine(<TradingNotes />)
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
    
    // Click delete button for first trade
    const deleteButtons = screen.getAllByLabelText('Delete')
    await user.click(deleteButtons[0])
    
    await waitFor(() => {
      expect(apiClient.deleteTrade).toHaveBeenCalledWith(1)
    })
  })

  it('should filter trades by search term', async () => {
    const user = userEvent.setup()
    renderWithMantine(<TradingNotes />)
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
    })
    
    // Search for AAPL
    const searchInput = screen.getByPlaceholderText('Search by symbol or notes...')
    await user.type(searchInput, 'AAPL')
    
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('GOOGL')).not.toBeInTheDocument()
  })

  it('should filter trades by status', async () => {
    const user = userEvent.setup()
    renderWithMantine(<TradingNotes />)
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
    
    // Filter by open positions
    const filterButton = screen.getByText('Filter: All Trades')
    await user.click(filterButton)
    
    const openOption = screen.getByText('Open Positions')
    await user.click(openOption)
    
    // Should show filter button updated
    expect(screen.getByText('Filter: Open Positions')).toBeInTheDocument()
  })

  it('should display profit-only trades correctly', async () => {
    renderWithMantine(<TradingNotes />)
    
    await waitFor(() => {
      // Profit-only trade should show dashes for irrelevant fields
      const rows = screen.getAllByRole('row')
      const googlRow = rows.find(row => row.textContent.includes('GOOGL'))
      
      expect(googlRow).toHaveTextContent('-') // For shares, buy price, sell price, sell date
      expect(googlRow).toHaveTextContent('$100.00') // For profit
    })
  })

  it('should handle loading state', () => {
    apiClient.getTrades.mockImplementation(() => new Promise(() => {})) // Never resolves
    
    renderWithMantine(<TradingNotes />)
    
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })

  it('should handle empty state', async () => {
    apiClient.getTrades.mockResolvedValue([])
    
    renderWithMantine(<TradingNotes />)
    
    await waitFor(() => {
      expect(screen.getByText('No trades yet')).toBeInTheDocument()
      expect(screen.getByText('Start by adding your first trade')).toBeInTheDocument()
    })
  })
})
