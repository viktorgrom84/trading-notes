import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import apiClient from '../api'

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalTrades: 0,
    totalProfit: 0,
    winRate: 0,
    avgProfit: 0
  })
  const [recentTrades, setRecentTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTradingData()
  }, [])

  const loadTradingData = async () => {
    try {
      setLoading(true)
      const [trades, statistics] = await Promise.all([
        apiClient.getTrades(),
        apiClient.getStatistics()
      ])
      
      setRecentTrades(trades.slice(0, 5))
      setStats(statistics)
    } catch (error) {
      console.error('Error loading trading data:', error)
    } finally {
      setLoading(false)
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

  const getProfitColor = (profit) => {
    if (profit > 0) return 'profit-positive'
    if (profit < 0) return 'profit-negative'
    return 'profit-neutral'
  }

  const getProfitIcon = (profit) => {
    if (profit > 0) return <ArrowUpRight className="w-4 h-4" />
    if (profit < 0) return <ArrowDownRight className="w-4 h-4" />
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded-lg w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="stat-card">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-32"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Trading Dashboard</h1>
          <p className="text-gray-600">Track your trading performance and manage your notes</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Total Trades</p>
                <p className="stat-value">{stats.totalTrades}</p>
              </div>
              <div className="p-3 bg-primary-100 rounded-xl">
                <BarChart3 className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Total Profit</p>
                <p className={`stat-value ${getProfitColor(stats.totalProfit)}`}>
                  {formatCurrency(stats.totalProfit)}
                </p>
              </div>
              <div className="p-3 bg-success-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Win Rate</p>
                <p className="stat-value">{stats.winRate.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Avg Profit</p>
                <p className={`stat-value ${getProfitColor(stats.avgProfit)}`}>
                  {formatCurrency(stats.avgProfit)}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <TrendingDown className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
              <div className="space-y-4">
                <Link
                  to="/trades"
                  className="btn btn-primary btn-lg w-full justify-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add New Trade
                </Link>
                <Link
                  to="/statistics"
                  className="btn btn-outline btn-lg w-full justify-center"
                >
                  <BarChart3 className="w-5 h-5 mr-2" />
                  View Statistics
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Recent Trades</h3>
                <Link
                  to="/trades"
                  className="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  View all
                </Link>
              </div>
              
              {recentTrades.length > 0 ? (
                <div className="space-y-4">
                  {recentTrades.map((trade) => {
                    const profit = trade.sell_price && trade.sell_date 
                      ? (trade.sell_price - trade.buy_price) * trade.shares
                      : null
                    
                    return (
                      <div key={trade.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h4 className="font-semibold text-gray-900">{trade.symbol}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              trade.sell_price && trade.sell_date 
                                ? 'bg-gray-100 text-gray-700' 
                                : 'bg-primary-100 text-primary-700'
                            }`}>
                              {trade.sell_price && trade.sell_date ? 'Closed' : 'Open'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {trade.shares} shares @ {formatCurrency(trade.buy_price)}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          {profit !== null ? (
                            <div className={`flex items-center space-x-1 ${getProfitColor(profit)}`}>
                              {getProfitIcon(profit)}
                              <span className="font-semibold">
                                {formatCurrency(profit)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Open position</span>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(trade.buy_date)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg mb-2">No trades yet</p>
                  <p className="text-gray-400 mb-6">Start by adding your first trade</p>
                  <Link
                    to="/trades"
                    className="btn btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Trade
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard