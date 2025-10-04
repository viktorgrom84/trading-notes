import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
  Modal,
  TextInput,
  NumberInput
} from '@mantine/core'
import { 
  IconPlus, 
  IconTrendingUp, 
  IconTrendingDown, 
  IconCurrencyDollar, 
  IconChartBar,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus
} from '@tabler/icons-react'
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
  const [performanceTarget, setPerformanceTarget] = useState(0)
  const [currentPerformance, setCurrentPerformance] = useState(0)
  const [showTargetModal, setShowTargetModal] = useState(false)

  const loadTradingData = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    loadTradingData()
    loadPerformanceTarget()
  }, [loadTradingData])

  const loadPerformanceTarget = useCallback(() => {
    const saved = localStorage.getItem('performanceTarget')
    if (saved) {
      setPerformanceTarget(parseFloat(saved))
    }
  }, [])

  const savePerformanceTarget = useCallback((target) => {
    setPerformanceTarget(target)
    localStorage.setItem('performanceTarget', target.toString())
  }, [])

  // Calculate current performance based on target + total profit
  const calculatedPerformance = useMemo(() => {
    return performanceTarget + stats.totalProfit
  }, [performanceTarget, stats.totalProfit])

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }, [])

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '-'
    try {
      const utcDate = new Date(dateString)
      if (isNaN(utcDate.getTime())) return '-'
      return utcDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      })
    } catch (error) {
      return '-'
    }
  }, [])

  const getProfitColor = useCallback((profit) => {
    if (profit > 0) return 'green'
    if (profit < 0) return 'red'
    return 'gray'
  }, [])

  const getProfitIcon = useCallback((profit) => {
    if (profit > 0) return <IconArrowUpRight size={16} />
    if (profit < 0) return <IconArrowDownRight size={16} />
    return <IconMinus size={16} />
  }, [])

  const StatCard = useCallback(({ title, value, icon, color = 'blue' }) => (
    <Card withBorder radius="md" p="xl">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed" fw={500}>
            {title}
          </Text>
          <Text size="xl" fw={700} c={getProfitColor(value)}>
            {title === 'Total Trades' ? value : (typeof value === 'number' && value !== 0 ? formatCurrency(value) : value)}
          </Text>
        </div>
        <ThemeIcon size="xl" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  ), [getProfitColor, formatCurrency])

  const processedRecentTrades = useMemo(() => {
    return recentTrades.map((trade) => {
      // Check if this is a profit-only trade
      const isProfitOnlyTrade = trade.shares === 1 && trade.buy_price === 0 && 
                               trade.buy_date === trade.sell_date && 
                               trade.notes && trade.notes.includes('Profit-only trade');
      
      let profit;
      if (trade.sell_price && trade.sell_date) {
        if (isProfitOnlyTrade) {
          profit = trade.sell_price; // For profit-only trades, sell_price contains the profit
        } else {
          profit = (trade.sell_price - trade.buy_price) * trade.shares;
        }
      } else {
        profit = null;
      }
      
      return {
        ...trade,
        isProfitOnlyTrade,
        profit
      }
    })
  }, [recentTrades])

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
          <Title order={1} mb="sm">Trading Dashboard</Title>
          <Text c="dimmed" size="lg">Track your trading performance and manage your notes</Text>
        </div>

        {/* Performance Tracker */}
        <Card withBorder radius="md" p="xl" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Group justify="space-between" mb="md">
            <div>
              <Title order={3} c="white">Performance Tracker</Title>
              <Text c="white" size="sm" opacity={0.9}>
                Track your trading performance against your target
              </Text>
            </div>
            <Button
              variant="white"
              size="sm"
              onClick={() => setShowTargetModal(true)}
            >
              Set Target
            </Button>
          </Group>
          
          <Group justify="space-between" align="center">
            <div>
              <Text size="sm" c="white" opacity={0.8}>Current Performance</Text>
              <Text size="xl" fw={700} c="white">
                {formatCurrency(calculatedPerformance)}
              </Text>
              <Text size="sm" c="white" opacity={0.7}>
                Target: {formatCurrency(performanceTarget)} + P/L: {formatCurrency(stats.totalProfit)}
              </Text>
            </div>
            <ThemeIcon size={60} variant="white" color="transparent">
              {calculatedPerformance >= performanceTarget ? 
                <IconTrendingUp size={30} color="green" /> : 
                <IconTrendingDown size={30} color="red" />
              }
            </ThemeIcon>
          </Group>
        </Card>

        {/* Stats Cards */}
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
            value={`${stats.winRate.toFixed(1)}`}
            icon={<IconTrendingUp size={24} />}
            color={Number(stats.winRate) >= 65 ? 'green' : 'red'} // Updated threshold
          />
          <StatCard
            title="Avg Profit"
            value={stats.avgProfitPerTrade || 0}
            icon={<IconTrendingDown size={24} />}
            color={(stats.avgProfitPerTrade || 0) >= 0 ? 'green' : 'red'}
          />
        </SimpleGrid>

        {/* Main Content */}
        <Grid>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card withBorder radius="md" p="xl">
              <Stack gap="md">
                <Title order={3}>Quick Actions</Title>
                <Button
                  component={Link}
                  to="/trades"
                  leftSection={<IconPlus size={16} />}
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'purple' }}
                  fullWidth
                  size="md"
                >
                  Add New Trade
                </Button>
                <Button
                  component={Link}
                  to="/statistics"
                  leftSection={<IconChartBar size={16} />}
                  variant="outline"
                  fullWidth
                  size="md"
                >
                  View Statistics
                </Button>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card withBorder radius="md" p="xl">
              <Group justify="space-between" mb="md">
                <Title order={3}>Recent Trades</Title>
                <Button
                  component={Link}
                  to="/trades"
                  variant="subtle"
                  size="sm"
                >
                  View all
                </Button>
              </Group>
              
              {processedRecentTrades.length > 0 ? (
                <Stack gap="sm">
                  {processedRecentTrades.map((trade) => (
                    <Paper key={trade.id} withBorder p="md" radius="md">
                      <Group justify="space-between">
                        <Group>
                          <Text fw={600} size="lg">{trade.symbol}</Text>
                          <Badge 
                            color={trade.sell_price && trade.sell_date ? 'gray' : 'blue'}
                            variant="light"
                          >
                            {trade.sell_price && trade.sell_date ? 'Closed' : 'Open'}
                          </Badge>
                        </Group>
                        <Group>
                          {trade.profit !== null ? (
                            <Group gap="xs">
                              <ActionIcon size="sm" color={getProfitColor(trade.profit)} variant="light">
                                {getProfitIcon(trade.profit)}
                              </ActionIcon>
                              <Text fw={600} c={getProfitColor(trade.profit)}>
                                {formatCurrency(trade.profit)}
                              </Text>
                            </Group>
                          ) : (
                            <Text size="sm" c="dimmed">Open position</Text>
                          )}
                        </Group>
                      </Group>
                      <Text size="sm" c="dimmed" mt="xs">
                        {trade.isProfitOnlyTrade ? (
                          `Profit trade • ${formatDate(trade.buy_date)}`
                        ) : (
                          `${trade.shares} shares @ ${formatCurrency(trade.buy_price)} • ${formatDate(trade.buy_date)}`
                        )}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Center py="xl">
                  <Stack align="center" gap="md">
                    <ThemeIcon size="xl" variant="light" color="gray">
                      <IconChartBar size={32} />
                    </ThemeIcon>
                    <div style={{ textAlign: 'center' }}>
                      <Text size="lg" fw={500} mb="xs">No trades yet</Text>
                      <Text c="dimmed" mb="md">Start by adding your first trade</Text>
                      <Button
                        component={Link}
                        to="/trades"
                        leftSection={<IconPlus size={16} />}
                        variant="gradient"
                        gradient={{ from: 'blue', to: 'purple' }}
                      >
                        Add Your First Trade
                      </Button>
                    </div>
                  </Stack>
                </Center>
              )}
            </Card>
          </Grid.Col>
        </Grid>

        {/* Performance Target Modal */}
        <Modal
          opened={showTargetModal}
          onClose={() => setShowTargetModal(false)}
          title="Set Performance Target"
          size="md"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Set your starting performance target. This will be your baseline, and your trading P/L will be added/subtracted from this number.
            </Text>
            
            <NumberInput
              label="Performance Target"
              placeholder="Enter your target amount"
              value={performanceTarget}
              onChange={(value) => setCurrentPerformance(value || 0)}
              prefix="$"
              thousandSeparator=","
              decimalScale={2}
              size="lg"
            />
            
            <Text size="sm" c="dimmed">
              Current calculation: {formatCurrency(performanceTarget)} + {formatCurrency(stats.totalProfit)} = {formatCurrency(performanceTarget + stats.totalProfit)}
            </Text>
            
            <Group justify="flex-end" gap="sm">
              <Button
                variant="outline"
                onClick={() => setShowTargetModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  savePerformanceTarget(currentPerformance)
                  setShowTargetModal(false)
                }}
              >
                Save Target
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  )
}

export default Dashboard