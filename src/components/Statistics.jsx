import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart as PieChartIcon } from 'lucide-react'
import apiClient from '../api'

const Statistics = () => {
  const [trades, setTrades] = useState([])
  const [timeRange, setTimeRange] = useState('6months')
  const [chartType, setChartType] = useState('line')
  const [loading, setLoading] = useState(true)

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

  const getFilteredTrades = () => {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const allTime = new Date(0)

    let cutoffDate
    switch (timeRange) {
      case '6months':
        cutoffDate = sixMonthsAgo
        break
      case '1year':
        cutoffDate = oneYearAgo
        break
      case 'all':
      default:
        cutoffDate = allTime
        break
    }

    return trades.filter(trade => {
      const tradeDate = new Date(trade.buy_date)
      return tradeDate >= cutoffDate
    })
  }

  const getCompletedTrades = () => {
    return getFilteredTrades().filter(trade => trade.sell_price && trade.sell_date)
  }

  const calculateStats = () => {
    const completedTrades = getCompletedTrades()
    const totalTrades = completedTrades.length
    
    if (totalTrades === 0) {
      return {
        totalProfit: 0,
        winRate: 0,
        avgProfit: 0,
        bestTrade: 0,
        worstTrade: 0,
        totalVolume: 0
      }
    }

    const profits = completedTrades.map(trade => {
      const profit = (trade.sell_price - trade.buy_price) * trade.shares
      const volume = trade.buy_price * trade.shares
      return { profit, volume, trade }
    })

    const totalProfit = profits.reduce((sum, p) => sum + p.profit, 0)
    const totalVolume = profits.reduce((sum, p) => sum + p.volume, 0)
    const winningTrades = profits.filter(p => p.profit > 0).length
    const winRate = (winningTrades / totalTrades) * 100
    const avgProfit = totalProfit / totalTrades
    const bestTrade = Math.max(...profits.map(p => p.profit))
    const worstTrade = Math.min(...profits.map(p => p.profit))

    return {
      totalProfit,
      winRate,
      avgProfit,
      bestTrade,
      worstTrade,
      totalVolume
    }
  }

  const getChartData = () => {
    const completedTrades = getCompletedTrades()
    const sortedTrades = completedTrades.sort((a, b) => new Date(a.buy_date) - new Date(b.buy_date))
    
    let cumulativeProfit = 0
    return sortedTrades.map(trade => {
      const profit = (trade.sell_price - trade.buy_price) * trade.shares
      cumulativeProfit += profit
      return {
        date: new Date(trade.buy_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        profit: profit,
        cumulativeProfit: cumulativeProfit,
        symbol: trade.symbol
      }
    })
  }

  const getSymbolData = () => {
    const completedTrades = getCompletedTrades()
    const symbolMap = {}
    
    completedTrades.forEach(trade => {
      if (!symbolMap[trade.symbol]) {
        symbolMap[trade.symbol] = { profit: 0, count: 0 }
      }
      symbolMap[trade.symbol].profit += (trade.sell_price - trade.buy_price) * trade.shares
      symbolMap[trade.symbol].count += 1
    })

    return Object.entries(symbolMap).map(([symbol, data]) => ({
      symbol,
      profit: data.profit,
      count: data.count
    })).sort((a, b) => b.profit - a.profit)
  }

  const getWinLossData = () => {
    const completedTrades = getCompletedTrades()
    const winning = completedTrades.filter(trade => 
      (trade.sell_price - trade.buy_price) * trade.shares > 0
    ).length
    const losing = completedTrades.length - winning

    return [
      { name: 'Winning Trades', value: winning, color: '#10b981' },
      { name: 'Losing Trades', value: losing, color: '#ef4444' }
    ]
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const stats = calculateStats()
  const chartData = getChartData()
  const symbolData = getSymbolData()
  const winLossData = getWinLossData()

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  if (loading) {
    return (
      <div className="container py-6">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading statistics...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Trading Statistics</h1>
        <p className="text-gray-600">Analyze your trading performance and trends</p>
      </div>

      {/* Time Range Selector */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 md:mb-0">Time Range</h3>
          <div className="flex space-x-2">
            {[
              { value: '6months', label: '6 Months' },
              { value: '1year', label: '1 Year' },
              { value: 'all', label: 'All Time' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={`btn ${timeRange === option.value ? 'btn-primary' : 'btn-secondary'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Profit</p>
              <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green' : 'text-red'}`}>
                {formatCurrency(stats.totalProfit)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Win Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.winRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Profit</p>
              <p className={`text-2xl font-bold ${stats.avgProfit >= 0 ? 'text-green' : 'text-red'}`}>
                {formatCurrency(stats.avgProfit)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Best Trade</p>
              <p className="text-2xl font-bold text-green">{formatCurrency(stats.bestTrade)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Worst Trade</p>
              <p className="text-2xl font-bold text-red">{formatCurrency(stats.worstTrade)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalVolume)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Profit Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Profit Over Time</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setChartType('line')}
                className={`btn ${chartType === 'line' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Line
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`btn ${chartType === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Bar
              </button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrency(value), 'Profit']} />
                  <Line 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrency(value), 'Profit']} />
                  <Bar dataKey="profit" fill="#3b82f6" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss Pie Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Win/Loss Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Symbol Performance */}
      {symbolData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Symbol</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Symbol</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Trades</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Total Profit</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Avg Profit</th>
                </tr>
              </thead>
              <tbody>
                {symbolData.map((item, index) => (
                  <tr key={item.symbol} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium">{item.symbol}</td>
                    <td className="py-3 px-4">{item.count}</td>
                    <td className={`py-3 px-4 font-medium ${item.profit >= 0 ? 'text-green' : 'text-red'}`}>
                      {formatCurrency(item.profit)}
                    </td>
                    <td className={`py-3 px-4 ${item.profit >= 0 ? 'text-green' : 'text-red'}`}>
                      {formatCurrency(item.profit / item.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {getCompletedTrades().length === 0 && (
        <div className="card text-center py-12">
          <PieChartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No completed trades to analyze</p>
          <p className="text-gray-400">Complete some trades to see your statistics and charts</p>
        </div>
      )}
    </div>
  )
}

export default Statistics
