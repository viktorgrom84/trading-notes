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

describe('TradingNotes Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle network errors when loading trades', async () => {
    apiClient.getTrades.mockRejectedValue(new Error('Network error'))
    
    renderWithMantine(<TradingNotes />)
    
    // Should show error notification
    await waitFor(() => {
      expect(screen.getByText('Failed to load trades')).toBeInTheDocument()
    })
  })

  it('should handle server errors when creating trade', async () => {
    const user = userEvent.setup()
    apiClient.getTrades.mockResolvedValue([])
    apiClient.createTrade.mockRejectedValue(new Error('Server error'))
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in form
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Should show error notification
    await waitFor(() => {
      expect(screen.getByText('Failed to save trade')).toBeInTheDocument()
    })
  })

  it('should handle server errors when updating trade', async () => {
    const user = userEvent.setup()
    const mockTrade = {
      id: 1,
      symbol: 'AAPL',
      shares: 100,
      buy_price: 150.00,
      buy_date: '2024-01-03',
      sell_price: null,
      sell_date: null,
      notes: 'Test trade'
    }
    
    apiClient.getTrades.mockResolvedValue([mockTrade])
    apiClient.updateTrade.mockRejectedValue(new Error('Update failed'))
    
    renderWithMantine(<TradingNotes />)
    
    // Wait for trade to load
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
    
    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)
    
    // Modify the trade
    await user.clear(screen.getByLabelText('Symbol'))
    await user.type(screen.getByLabelText('Symbol'), 'GOOGL')
    
    const updateButton = screen.getByText('Update Trade')
    await user.click(updateButton)
    
    // Should show error notification
    await waitFor(() => {
      expect(screen.getByText('Failed to save trade')).toBeInTheDocument()
    })
  })

  it('should handle server errors when deleting trade', async () => {
    const user = userEvent.setup()
    const mockTrade = {
      id: 1,
      symbol: 'AAPL',
      shares: 100,
      buy_price: 150.00,
      buy_date: '2024-01-03',
      sell_price: null,
      sell_date: null,
      notes: 'Test trade'
    }
    
    apiClient.getTrades.mockResolvedValue([mockTrade])
    apiClient.deleteTrade.mockRejectedValue(new Error('Delete failed'))
    
    renderWithMantine(<TradingNotes />)
    
    // Wait for trade to load
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
    
    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    await user.click(deleteButton)
    
    // Should show error notification
    await waitFor(() => {
      expect(screen.getByText('Failed to delete trade')).toBeInTheDocument()
    })
  })

  it('should handle validation errors for profit-only trades', async () => {
    const user = userEvent.setup()
    apiClient.getTrades.mockResolvedValue([])
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Switch to profit-only mode
    const profitOnlyButton = screen.getByText('Profit Only')
    await user.click(profitOnlyButton)
    
    // Try to submit without filling required fields
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Should show validation errors
    expect(screen.getByText('Symbol is required')).toBeInTheDocument()
    expect(screen.getByText('Profit/Loss is required')).toBeInTheDocument()
    expect(screen.getByText('Trade date is required')).toBeInTheDocument()
  })

  it('should handle validation errors for regular trades', async () => {
    const user = userEvent.setup()
    apiClient.getTrades.mockResolvedValue([])
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Try to submit without filling required fields
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Should show validation errors
    expect(screen.getByText('Symbol is required')).toBeInTheDocument()
    expect(screen.getByText('Shares must be greater than 0')).toBeInTheDocument()
    expect(screen.getByText('Buy price must be greater than 0')).toBeInTheDocument()
    expect(screen.getByText('Buy date is required')).toBeInTheDocument()
  })

  it('should handle invalid share quantities', async () => {
    const user = userEvent.setup()
    apiClient.getTrades.mockResolvedValue([])
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in form with invalid shares
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '0') // Invalid
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Should show validation error
    expect(screen.getByText('Shares must be greater than 0')).toBeInTheDocument()
  })

  it('should handle invalid buy prices', async () => {
    const user = userEvent.setup()
    apiClient.getTrades.mockResolvedValue([])
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in form with invalid buy price
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '-10.00') // Invalid
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Should show validation error
    expect(screen.getByText('Buy price must be greater than 0')).toBeInTheDocument()
  })

  it('should handle API timeout errors', async () => {
    const user = userEvent.setup()
    apiClient.getTrades.mockResolvedValue([])
    apiClient.createTrade.mockRejectedValue(new Error('Request timeout'))
    
    renderWithMantine(<TradingNotes />)
    
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in form
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Shares'), '100')
    await user.type(screen.getByLabelText('Buy Price'), '150.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-03')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // Should show error notification
    await waitFor(() => {
      expect(screen.getByText('Failed to save trade')).toBeInTheDocument()
    })
  })

  it('should handle malformed API responses', async () => {
    const user = userEvent.setup()
    apiClient.getTrades.mockResolvedValue(null) // Malformed response
    
    renderWithMantine(<TradingNotes />)
    
    // Should handle gracefully without crashing
    await waitFor(() => {
      expect(screen.getByText('No trades yet')).toBeInTheDocument()
    })
  })

  it('should handle empty API responses', async () => {
    const user = userEvent.setup()
    apiClient.getTrades.mockResolvedValue([])
    
    renderWithMantine(<TradingNotes />)
    
    // Should show empty state
    await waitFor(() => {
      expect(screen.getByText('No trades yet')).toBeInTheDocument()
    })
  })

  it('should handle concurrent operations gracefully', async () => {
    const user = userEvent.setup()
    const mockTrades = [
      { id: 1, symbol: 'AAPL', shares: 100, buy_price: 150.00, buy_date: '2024-01-03' },
      { id: 2, symbol: 'GOOGL', shares: 50, buy_price: 200.00, buy_date: '2024-01-04' }
    ]
    
    apiClient.getTrades.mockResolvedValue(mockTrades)
    apiClient.createTrade.mockResolvedValue({ id: 3, symbol: 'MSFT' })
    apiClient.deleteTrade.mockResolvedValue({ message: 'Deleted' })
    
    renderWithMantine(<TradingNotes />)
    
    // Wait for trades to load
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })
    
    // Start multiple operations simultaneously
    const addButton = screen.getByText('Add Trade')
    await user.click(addButton)
    
    // Fill in new trade
    await user.type(screen.getByLabelText('Symbol'), 'MSFT')
    await user.type(screen.getByLabelText('Shares'), '75')
    await user.type(screen.getByLabelText('Buy Price'), '300.00')
    await user.type(screen.getByLabelText('Buy Date'), '2024-01-05')
    
    const submitButton = screen.getByText('Add Trade')
    await user.click(submitButton)
    
    // While that's processing, try to delete a trade
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    await user.click(deleteButton)
    
    // Both operations should complete successfully
    await waitFor(() => {
      expect(apiClient.createTrade).toHaveBeenCalled()
      expect(apiClient.deleteTrade).toHaveBeenCalled()
    })
  })
})
