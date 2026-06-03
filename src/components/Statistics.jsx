import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Container, 
  Grid, 
  Card, 
  Text, 
  Group, 
  Stack, 
  ThemeIcon, 
  Skeleton,
  Center,
  Box,
  SimpleGrid,
  Title,
  ActionIcon,
  SegmentedControl,
  Table,
  UnstyledButton,
} from '@mantine/core'
import { 
  IconTrendingUp, 
  IconTrendingDown, 
  IconCurrencyDollar, 
  IconChartBar,
  IconArrowUpRight,
  IconArrowDownRight,
  IconChartPie,
  IconSelector,
  IconChevronUp,
  IconChevronDown,
} from '@tabler/icons-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { useTrades } from '../context/TradesContext'
import { formatCurrency, getProfitColor, parseLocalDate } from '../utils/format'
import { tradeProfit, isTradeClosed } from '../utils/tradeProfit'

// All supported time ranges
const TIME_RANGES = [
  { label: '1M',  value: '1month'  },
  { label: '3M',  value: '3months' },
  { label: '6M',  value: '6months' },
  { label: '1Y',  value: '1year'   },
  { label: '2Y',  value: '2years'  },
  { label: 'All', value: 'all'     },
]

const VALID_SORT_COLS = ['symbol', 'count', 'profit', 'avg']
const VALID_DIRS      = ['asc', 'desc']
const VALID_RANGES    = TIME_RANGES.map(r => r.value)

const Statistics = () => {
  const { trades, loading } = useTrades()
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialise all filter/sort state from URL
  const [timeRange, setTimeRange] = useState(() =>
    VALID_RANGES.includes(searchParams.get('range')) ? searchParams.get('range') : '6months'
  )
  const [chartType, setChartType] = useState('line')
  const [sortCol, setSortCol] = useState(() =>
    VALID_SORT_COLS.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'profit'
  )
  const [sortDir, setSortDir] = useState(() =>
    VALID_DIRS.includes(searchParams.get('dir')) ? searchParams.get('dir') : 'desc'
  )

  const updateRange = (range) => {
    setTimeRange(range)
    setSearchParams(p => { const n = new URLSearchParams(p); n.set('range', range); return n }, { replace: true })
  }

  const getFilteredTrades = () => {
    const now = new Date()
    const cutoffs = {
      '1month':  new Date(now.getFullYear(), now.getMonth() - 1,  now.getDate()),
      '3months': new Date(now.getFullYear(), now.getMonth() - 3,  now.getDate()),
      '6months': new Date(now.getFullYear(), now.getMonth() - 6,  now.getDate()),
      '1year':   new Date(now.getFullYear() - 1, now.getMonth(),  now.getDate()),
      '2years':  new Date(now.getFullYear() - 2, now.getMonth(),  now.getDate()),
      'all':     new Date(0),
    }
    const cutoffDate = cutoffs[timeRange] ?? new Date(0)
    return trades.filter(trade => (parseLocalDate(trade.buy_date) ?? new Date(0)) >= cutoffDate)
  }

  const getCompletedTrades = () => getFilteredTrades().filter(isTradeClosed)

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
      const profit = tradeProfit(trade)
      const isProfitOnly = trade.trade_type === 'profit_only' ||
        (trade.shares === 1 && trade.buy_price === 0 && trade.sell_price && trade.sell_price !== 0)
      const isOption = trade.trade_type === 'option'
      const volume = isProfitOnly || isOption ? 0
        : trade.position_type === 'short'
          ? trade.sell_price * trade.shares
          : trade.buy_price * trade.shares
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

    // Use buy_date for options/profit_only (when premium was collected),
    // sell_date for regular trades (when position was closed)
    const getExitDate = (trade) =>
      (trade.trade_type === 'option' || trade.trade_type === 'profit_only')
        ? trade.buy_date
        : trade.sell_date || trade.buy_date

    // Aggregate into one data point per calendar day
    const dailyMap = {}
    completedTrades.forEach(trade => {
      const raw = getExitDate(trade)
      if (!raw) return
      const key = (parseLocalDate(raw) ?? new Date(raw)).toLocaleDateString('en-CA')
      if (!dailyMap[key]) dailyMap[key] = { key, profit: 0, trades: 0 }
      dailyMap[key].profit += tradeProfit(trade) ?? 0
      dailyMap[key].trades += 1
    })

    // Sort chronologically and build chart rows
    let cumulative = 0
    return Object.values(dailyMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ key, profit, trades }) => {
        cumulative += profit
        return {
          date: new Date(key + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          profit,
          trades,
          cumulativeProfit: cumulative,
        }
      })
  }

  // Monthly breakdown — always uses ALL closed trades (not time-range filtered)
  const getMonthlyData = () => {
    const closed = trades.filter(isTradeClosed)
    const map = {}
    closed.forEach(trade => {
      const raw = (trade.trade_type === 'option' || trade.trade_type === 'profit_only')
        ? trade.buy_date
        : trade.sell_date || trade.buy_date
      if (!raw) return
      const d = parseLocalDate(raw)
      if (!d) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { profit: 0, trades: 0, wins: 0 }
      const p = tradeProfit(trade) ?? 0
      map[key].profit += p
      map[key].trades += 1
      if (p > 0) map[key].wins += 1
    })
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .map(([key, { profit, trades, wins }]) => ({
        key,
        label: new Date(key + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        profit,
        trades,
        winRate: trades > 0 ? Math.round((wins / trades) * 100) : 0,
      }))
  }

  const getSymbolData = () => {
    const completedTrades = getCompletedTrades()
    const symbolMap = {}

    completedTrades.forEach(trade => {
      // Normalise to avoid "BULL" vs "BULL " duplicates
      const key = (trade.symbol || '').trim().toUpperCase()
      if (!symbolMap[key]) symbolMap[key] = { profit: 0, count: 0 }
      symbolMap[key].profit += tradeProfit(trade) ?? 0
      symbolMap[key].count  += 1
    })

    const rows = Object.entries(symbolMap).map(([symbol, data]) => ({
      symbol,
      profit: data.profit,
      count:  data.count,
      avg:    data.profit / data.count,
    }))

    // Apply current sort
    rows.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (sortCol === 'symbol') {
        av = av.toLowerCase()
        bv = bv.toLowerCase()
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })

    return rows
  }

  const toggleSort = (col) => {
    const newDir = sortCol === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc'
    const newCol = col
    setSortCol(newCol)
    setSortDir(newDir)
    setSearchParams(p => {
      const n = new URLSearchParams(p)
      n.set('sort', newCol)
      n.set('dir', newDir)
      return n
    }, { replace: true })
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <IconSelector size={14} style={{ opacity: 0.4 }} />
    return sortDir === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
  }

  const getWinLossData = () => {
    const completedTrades = getCompletedTrades()
    const winning = completedTrades.filter(trade => tradeProfit(trade) > 0).length
    const losing = completedTrades.length - winning

    return [
      { name: 'Winning Trades', value: winning, color: '#10b981' },
      { name: 'Losing Trades', value: losing, color: '#ef4444' }
    ]
  }

  const stats = calculateStats()
  const chartData = getChartData()
  const symbolData = getSymbolData()
  const winLossData = getWinLossData()

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  // valueColor: explicit text colour; falls back to green/red for numbers, 'inherit' for strings
  const StatCard = ({ title, value, icon, color = 'blue', valueColor }) => {
    const textColor = valueColor
      ?? (title === 'Total Trades' ? 'dark' : typeof value === 'number' ? getProfitColor(value) : 'inherit')
    const display = title === 'Total Trades'
      ? value
      : typeof value === 'number' ? formatCurrency(value) : value
    return (
      <Card withBorder radius="md" p="xl">
        <Group justify="space-between">
          <div>
            <Text size="sm" c="dimmed" fw={500} mb="xs">{title}</Text>
            <Text size="xl" fw={700} c={textColor}>{display}</Text>
          </div>
          <ThemeIcon size="xl" variant="light" color={color}>
            {icon}
          </ThemeIcon>
        </Group>
      </Card>
    )
  }

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
              onChange={updateRange}
              data={TIME_RANGES}
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
            title="Win Rate %"
            value={`${stats.winRate.toFixed(1)}%`}
            icon={<IconTrendingUp size={24} />}
            color={stats.winRate >= 65 ? 'green' : 'red'}
            valueColor={stats.winRate >= 65 ? 'green' : 'red'}
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
                    { label: 'Bar',  value: 'bar'  },
                  ]}
                />
              </Group>
              <Box h={300}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value, name, props) => [
                          `${formatCurrency(value)} (${props.payload?.trades ?? 1} trade${(props.payload?.trades ?? 1) !== 1 ? 's' : ''})`,
                          'Daily P&L',
                        ]}
                        labelFormatter={(l) => `Date: ${l}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 3 }}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value, name, props) => [
                          `${formatCurrency(value)} (${props.payload?.trades ?? 1} trade${(props.payload?.trades ?? 1) !== 1 ? 's' : ''})`,
                          'Daily P&L',
                        ]}
                        labelFormatter={(l) => `Date: ${l}`}
                      />
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
              <Box h={400}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <Pie
                      data={winLossData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const shortName = name === 'Winning Trades' ? 'Wins' : 'Losses'
                        return `${shortName}: ${(percent * 100).toFixed(0)}%`
                      }}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {winLossData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [
                        value, 
                        name === 'Winning Trades' ? 'Winning Trades' : 'Losing Trades'
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Symbol Performance — sortable */}
        {symbolData.length > 0 && (
          <Card withBorder p="xl">
            <Title order={3} mb="md">Performance by Symbol</Title>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {[
                    { col: 'symbol', label: 'Symbol' },
                    { col: 'count',  label: 'Trades'  },
                    { col: 'profit', label: 'Total Profit' },
                    { col: 'avg',    label: 'Avg Profit' },
                  ].map(({ col, label }) => (
                    <Table.Th key={col} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <UnstyledButton onClick={() => toggleSort(col)}>
                        <Group gap={4} wrap="nowrap">
                          <Text fw={600} size="sm">{label}</Text>
                          <SortIcon col={col} />
                        </Group>
                      </UnstyledButton>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {symbolData.map((item) => (
                  <Table.Tr key={item.symbol}>
                    <Table.Td><Text fw={600}>{item.symbol}</Text></Table.Td>
                    <Table.Td>{item.count}</Table.Td>
                    <Table.Td>
                      <Text c={getProfitColor(item.profit)} fw={500}>
                        {formatCurrency(item.profit)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c={getProfitColor(item.avg)}>
                        {formatCurrency(item.avg)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}

        {/* Monthly Breakdown */}
        {(() => {
          const monthlyData = getMonthlyData()
          if (!monthlyData.length) return null
          return (
            <Card withBorder p="xl">
              <Title order={3} mb="md">Monthly Breakdown</Title>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Month</Table.Th>
                    <Table.Th>Trades</Table.Th>
                    <Table.Th>Win Rate</Table.Th>
                    <Table.Th>Total P&amp;L</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {monthlyData.map(row => (
                    <Table.Tr key={row.key}>
                      <Table.Td><Text fw={600}>{row.label}</Text></Table.Td>
                      <Table.Td>{row.trades}</Table.Td>
                      <Table.Td>
                        <Text c={row.winRate >= 60 ? 'green' : row.winRate >= 40 ? 'yellow' : 'red'} fw={500}>
                          {row.winRate}%
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700} c={getProfitColor(row.profit)}>
                          {formatCurrency(row.profit)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )
        })()}

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