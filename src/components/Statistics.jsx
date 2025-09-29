import { useState, useEffect } from 'react'
import { 
  Container, 
  Grid, 
  Card, 
  Text, 
  Group, 
  Stack, 
  Button, 
  ThemeIcon, 
  Badge, 
  Skeleton,
  Center,
  Box,
  SimpleGrid,
  Paper,
  Title,
  ActionIcon,
  SegmentedControl,
  Table,
  Progress
} from '@mantine/core'
import { 
  IconTrendingUp, 
  IconTrendingDown, 
  IconCurrencyDollar, 
  IconChartBar,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  IconChartPie,
  IconCalendar
} from '@tabler/icons-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
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
        totalTrades: 0,
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
      totalTrades,
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

  const StatCard = ({ title, value, icon, color = 'blue', trend = null }) => (
    <Card withBorder radius="md" p="xl">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed" fw={500} mb="xs">
            {title}
          </Text>
          <Text size="xl" fw={700} c={value >= 0 ? 'green' : 'red'}>
            {title === 'Total Trades' ? value : (typeof value === 'number' && value !== 0 ? formatCurrency(value) : value)}
          </Text>
          {trend && (
            <Group gap="xs" mt="xs">
              <ActionIcon size="sm" color={trend > 0 ? 'green' : 'red'} variant="light">
                {trend > 0 ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
              </ActionIcon>
              <Text size="xs" c={trend > 0 ? 'green' : 'red'}>
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </Text>
            </Group>
          )}
        </div>
        <ThemeIcon size="xl" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  )

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <div>
            <Skeleton height={32} width={300} mb="sm" />
            <Skeleton height={20} width={400} />
          </div>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={120} />
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <div>
          <Title order={1} mb="sm">Trading Statistics</Title>
          <Text c="dimmed" size="lg">Analyze your trading performance and trends</Text>
        </div>

        {/* Time Range Selector */}
        <Card withBorder p="md">
          <Group justify="space-between">
            <Text fw={500}>Time Range</Text>
            <SegmentedControl
              value={timeRange}
              onChange={setTimeRange}
              data={[
                { label: '6 Months', value: '6months' },
                { label: '1 Year', value: '1year' },
                { label: 'All Time', value: 'all' }
              ]}
            />
          </Group>
        </Card>

        {/* Stats Overview */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <StatCard
            title="Total Trades"
            value={stats.totalTrades}
            icon={<IconChartBar size={24} />}
            color="blue"
          />
          <StatCard
            title="Total Profit"
            value={stats.totalProfit}
            icon={<IconCurrencyDollar size={24} />}
            color={stats.totalProfit >= 0 ? 'green' : 'red'}
          />
          <StatCard
            title="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            icon={<IconTrendingUp size={24} />}
            color={stats.winRate >= 80 ? 'green' : stats.winRate >= 60 ? 'yellow' : 'red'}
          />
          <StatCard
            title="Avg Profit"
            value={stats.avgProfit}
            icon={<IconTrendingDown size={24} />}
            color={stats.avgProfit >= 0 ? 'green' : 'red'}
          />
        </SimpleGrid>

        {/* Additional Stats */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          <StatCard
            title="Best Trade"
            value={stats.bestTrade}
            icon={<IconArrowUpRight size={24} />}
            color="green"
          />
          <StatCard
            title="Worst Trade"
            value={stats.worstTrade}
            icon={<IconArrowDownRight size={24} />}
            color="red"
          />
          <StatCard
            title="Total Volume"
            value={stats.totalVolume}
            icon={<IconCurrencyDollar size={24} />}
            color="blue"
          />
        </SimpleGrid>

        {/* Charts */}
        <Grid>
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card withBorder p="xl">
              <Group justify="space-between" mb="md">
                <Title order={3}>Profit Over Time</Title>
                <SegmentedControl
                  value={chartType}
                  onChange={setChartType}
                  data={[
                    { label: 'Line', value: 'line' },
                    { label: 'Bar', value: 'bar' }
                  ]}
                />
              </Group>
              <Box h={300}>
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
              </Box>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card withBorder p="xl">
              <Title order={3} mb="md">Win/Loss Distribution</Title>
              <Box h={300}>
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
              </Box>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Symbol Performance */}
        {symbolData.length > 0 && (
          <Card withBorder p="xl">
            <Title order={3} mb="md">Performance by Symbol</Title>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Symbol</Table.Th>
                  <Table.Th>Trades</Table.Th>
                  <Table.Th>Total Profit</Table.Th>
                  <Table.Th>Avg Profit</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {symbolData.map((item) => (
                  <Table.Tr key={item.symbol}>
                    <Table.Td>
                      <Text fw={600}>{item.symbol}</Text>
                    </Table.Td>
                    <Table.Td>{item.count}</Table.Td>
                    <Table.Td>
                      <Text c={item.profit >= 0 ? 'green' : 'red'} fw={500}>
                        {formatCurrency(item.profit)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c={item.profit >= 0 ? 'green' : 'red'}>
                        {formatCurrency(item.profit / item.count)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}

        {getCompletedTrades().length === 0 && (
          <Card withBorder>
            <Center py="xl">
              <Stack align="center" gap="md">
                <ThemeIcon size="xl" variant="light" color="gray">
                  <IconChartPie size={32} />
                </ThemeIcon>
                <div style={{ textAlign: 'center' }}>
                  <Text size="lg" fw={500} mb="xs">No completed trades to analyze</Text>
                  <Text c="dimmed">Complete some trades to see your statistics and charts</Text>
                </div>
              </Stack>
            </Center>
          </Card>
        )}
      </Stack>
    </Container>
  )
}

export default Statistics