import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

describe('TradingNotes Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.getTrades.mockResolvedValue([])
  })

  it('should handle very large profit values', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'TSLA' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Switch to profit-only mode
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    // Fill in form with very large profit
    await user.type(screen.getByLabelText('Symbol'), 'TSLA')
    await user.type(screen.getByLabelText('Profit/Loss'), '999999999.99')
    await user.type(screen.getByLabelText('Trade Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'TSLA',
        profit: 999999999.99,
        buyDate: '2024-01-03',
        notes: null
      })
    })
  })

  it('should handle negative profit values', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'AAPL' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Switch to profit-only mode
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    // Fill in form with negative profit
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Profit/Loss'), '-150.50')
    await user.type(screen.getByLabelText('Trade Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'AAPL',
        profit: -150.50,
        buyDate: '2024-01-03',
        notes: null
      })
    })
  })

  it('should handle zero profit (break-even)', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'MSFT' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Switch to profit-only mode
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    // Fill in form with zero profit
    await user.type(screen.getByLabelText('Symbol'), 'MSFT')
    await user.type(screen.getByLabelText('Profit/Loss'), '0')
    await user.type(screen.getByLabelText('Trade Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'MSFT',
        profit: 0,
        buyDate: '2024-01-03',
        notes: null
      })
    })
  })

  it('should handle very large share quantities', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'GOOGL' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in regular trade with large share quantity
    await user.type(screen.getByLabelText('Symbol'), 'GOOGL')
    await user.type(screen.getByLabelText('Shares'), '1000000')
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'GOOGL',
        shares: 1000000,
        buyPrice: 150.00,
        buyDate: '2024-01-03',
        sellPrice: null,
        sellDate: null,
        notes: null
      })
    })
  })

  it('should handle very small decimal values', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'NVDA' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in regular trade with small decimal values
    await user.type(screen.getByLabelText('Symbol'), 'NVDA')
    await user.type(screen.getByLabelText('Shares'), '1')
    await user.type(screen.getByLabelText('Buy Price'), '0.01')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'NVDA',
        shares: 1,
        buyPrice: 0.01,
        buyDate: '2024-01-03',
        sellPrice: null,
        sellDate: null,
        notes: null
      })
    })
  })

  it('should handle very long symbol names', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'VERYLONGSYMBOLNAME' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in form with very long symbol
    await user.type(screen.getByLabelText('Symbol'), 'VERYLONGSYMBOLNAME')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '50.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'VERYLONGSYMBOLNAME',
        shares: 100,
        buyPrice: 50.00,
        buyDate: '2024-01-03',
        sellPrice: null,
        sellDate: null,
        notes: null
      })
    })
  })

  it('should handle very long notes', async () => {
    const user = userEvent.setup()
    const longNotes = 'A'.repeat(1000) // 1000 character note
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'AAPL' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in form with very long notes
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    await user.type(screen.getByLabelText('Notes'), longNotes)
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledWith({
        symbol: 'AAPL',
        shares: 100,
        buyPrice: 150.00,
        buyDate: '2024-01-03',
        sellPrice: null,
        sellDate: null,
        notes: longNotes
      })
    })
  })

  it('should handle rapid mode switching', async () => {
    const user = userEvent.setup()
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Rapidly switch between modes
    const regularButton = screen.getByText('Regular Trade')
    const profitOnlyButton = screen.getByText('Profit Only')
    
    await user.click(profitOnlyButton)
    await user.click(regularButton)
    await user.click(profitOnlyButton)
    await user.click(regularButton)
    
    // Should still work after rapid switching
    await user.type(screen.getByLabelText('Symbol'), 'TSLA')
    await user.type(screen.getByLabelText('Shares'), '10')
    await user.type(screen.getByLabelText('Buy Price'), '200.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    expect(screen.getByLabelText('Symbol')).toHaveValue('TSLA')
    expect(screen.getByLabelText('Shares')).toHaveValue(10)
    expect(screen.getByLabelText('Buy Price')).toHaveValue(200.00)
  })

  it('should handle form reset after mode switch', async () => {
    const user = userEvent.setup()
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in regular trade form
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    // Switch to profit-only mode
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    // Form should be reset
    expect(screen.getByLabelText('Symbol')).toHaveValue('')
    expect(screen.queryByLabelText('Shares')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buy Price')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Trade Date')).toHaveValue('')
  })

  it('should handle multiple rapid submissions', async () => {
    const user = userEvent.setup()
    apiClient.createTrade.mockResolvedValue({ id: 1, symbol: 'AAPL' })
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in form
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    
    // Rapidly click submit multiple times
    await user.click(submitButton)
    await user.click(submitButton)
    await user.click(submitButton)
    
    // Should only create one trade (prevent double submission)
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalledTimes(1)
    })
  })
})
