import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, Filter } from 'lucide-react'
import apiClient from '../api'

const TradingNotes = () => {
  const [trades, setTrades] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    symbol: '',
    shares: '',
    buyPrice: '',
    buyDate: '',
    sellPrice: '',
    sellDate: '',
    notes: ''
  })

  useEffect(() => {
    loadTrades()
  }, [])

  const loadTrades = async () => {
    try {
      setLoading(true)
      const trades = await apiClient.getTrades()
      setTrades(trades)
    } catch (error) {
      console.error('Error loading trades:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.symbol || !formData.shares || !formData.buyPrice || !formData.buyDate) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const tradeData = {
        symbol: formData.symbol,
        shares: parseInt(formData.shares),
        buyPrice: parseFloat(formData.buyPrice),
        sellPrice: formData.sellPrice ? parseFloat(formData.sellPrice) : null,
        buyDate: formData.buyDate,
        sellDate: formData.sellDate || null,
        notes: formData.notes || null
      }

      if (editingTrade) {
        await apiClient.updateTrade(editingTrade.id, tradeData)
      } else {
        await apiClient.createTrade(tradeData)
      }

      await loadTrades() // Reload trades from API
      resetForm()
    } catch (error) {
      console.error('Error saving trade:', error)
      alert('Error saving trade. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData({
      symbol: '',
      shares: '',
      buyPrice: '',
      buyDate: '',
      sellPrice: '',
      sellDate: '',
      notes: ''
    })
    setShowForm(false)
    setEditingTrade(null)
  }

  const handleEdit = (trade) => {
    setEditingTrade(trade)
    setFormData({
      symbol: trade.symbol,
      shares: trade.shares.toString(),
      buyPrice: trade.buy_price.toString(),
      buyDate: trade.buy_date,
      sellPrice: trade.sell_price ? trade.sell_price.toString() : '',
      sellDate: trade.sell_date || '',
      notes: trade.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (tradeId) => {
    if (window.confirm('Are you sure you want to delete this trade?')) {
      try {
        await apiClient.deleteTrade(tradeId)
        await loadTrades() // Reload trades from API
      } catch (error) {
        console.error('Error deleting trade:', error)
        alert('Error deleting trade. Please try again.')
      }
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getProfit = (trade) => {
    if (!trade.sell_price || !trade.sell_date) return null
    return (trade.sell_price - trade.buy_price) * trade.shares
  }

  const getProfitColor = (profit) => {
    if (profit === null) return 'text-gray-500'
    return profit >= 0 ? 'text-green' : 'text-red'
  }

  const getStatus = (trade) => {
    return trade.sell_price && trade.sell_date ? 'closed' : 'open'
  }

  const filteredTrades = trades.filter(trade => {
    const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (trade.notes && trade.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesFilter = filterStatus === 'all' || getStatus(trade) === filterStatus
    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="container py-6">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading trades...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Trading Notes</h1>
          <p className="text-gray-600">Manage your trading positions and track performance</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary mt-4 md:mt-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Trade
        </button>
      </div>

      {/* Search and Filter */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by symbol or notes..."
                className="form-input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Filter by Status</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                className="form-select pl-10"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Trades</option>
                <option value="open">Open Positions</option>
                <option value="closed">Closed Positions</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingTrade ? 'Edit Trade' : 'Add New Trade'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Symbol *</label>
                <input
                  type="text"
                  name="symbol"
                  className="form-input"
                  placeholder="e.g., AAPL"
                  value={formData.symbol}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Shares *</label>
                <input
                  type="number"
                  name="shares"
                  className="form-input"
                  placeholder="Number of shares"
                  value={formData.shares}
                  onChange={handleInputChange}
                  required
                  min="1"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Buy Price *</label>
                <input
                  type="number"
                  name="buyPrice"
                  className="form-input"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.buyPrice}
                  onChange={handleInputChange}
                  required
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Buy Date *</label>
                <input
                  type="date"
                  name="buyDate"
                  className="form-input"
                  value={formData.buyDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sell Price</label>
                <input
                  type="number"
                  name="sellPrice"
                  className="form-input"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.sellPrice}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sell Date</label>
                <input
                  type="date"
                  name="sellDate"
                  className="form-input"
                  value={formData.sellDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                className="form-input"
                rows="3"
                placeholder="Additional notes about this trade..."
                value={formData.notes}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingTrade ? 'Update Trade' : 'Add Trade'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trades List */}
      <div className="space-y-4">
        {filteredTrades.length > 0 ? (
          filteredTrades.map((trade) => {
            const profit = getProfit(trade)
            const status = getStatus(trade)
            
            return (
              <div key={trade.id} className="card">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{trade.symbol}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        status === 'open' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Shares</p>
                        <p className="font-medium">{trade.shares}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Buy Price</p>
                        <p className="font-medium">{formatCurrency(trade.buyPrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Buy Date</p>
                        <p className="font-medium">{formatDate(trade.buyDate)}</p>
                      </div>
                      {trade.sellPrice && (
                        <div>
                          <p className="text-gray-600">Sell Price</p>
                          <p className="font-medium">{formatCurrency(trade.sellPrice)}</p>
                        </div>
                      )}
                    </div>
                    {trade.notes && (
                      <div className="mt-2">
                        <p className="text-gray-600 text-sm">Notes</p>
                        <p className="text-sm">{trade.notes}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end mt-4 md:mt-0">
                    {profit !== null && (
                      <p className={`text-lg font-bold ${getProfitColor(profit)} mb-2`}>
                        {formatCurrency(profit)}
                      </p>
                    )}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(trade)}
                        className="btn btn-secondary"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(trade.id)}
                        className="btn btn-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No trades found</p>
            <p className="text-gray-400 mb-6">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Start by adding your first trade'
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Trade
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TradingNotes
