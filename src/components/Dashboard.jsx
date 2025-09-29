import { useState, useEffect } from 'react'
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
  ActionIcon
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
    if (profit > 0) return 'green'
    if (profit < 0) return 'red'
    return 'gray'
  }

  const getProfitIcon = (profit) => {
    if (profit > 0) return <IconArrowUpRight size={16} />
    if (profit < 0) return <IconArrowDownRight size={16} />
    return <IconMinus size={16} />
  }

  const StatCard = ({ title, value, icon, color = 'blue' }) => (
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
          <Title order={1} mb="sm">Trading Dashboard</Title>
          <Text c="dimmed" size="lg">Track your trading performance and manage your notes</Text>
        </div>

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
            title="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            icon={<IconTrendingUp size={24} />}
            color={stats.winRate >= 80 ? 'green' : stats.winRate >= 60 ? 'yellow' : 'red'}
          />
          <StatCard
            title="Avg Profit"
            value={stats.avgProfitPerTrade}
            icon={<IconTrendingDown size={24} />}
            color={stats.avgProfitPerTrade >= 0 ? 'green' : 'red'}
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
              
              {recentTrades.length > 0 ? (
                <Stack gap="sm">
                  {recentTrades.map((trade) => {
                    const profit = trade.sell_price && trade.sell_date 
                      ? (trade.sell_price - trade.buy_price) * trade.shares
                      : null
                    
                    return (
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
                            {profit !== null ? (
                              <Group gap="xs">
                                <ActionIcon size="sm" color={getProfitColor(profit)} variant="light">
                                  {getProfitIcon(profit)}
                                </ActionIcon>
                                <Text fw={600} c={getProfitColor(profit)}>
                                  {formatCurrency(profit)}
                                </Text>
                              </Group>
                            ) : (
                              <Text size="sm" c="dimmed">Open position</Text>
                            )}
                          </Group>
                        </Group>
                        <Text size="sm" c="dimmed" mt="xs">
                          {trade.shares} shares @ {formatCurrency(trade.buy_price)} • {formatDate(trade.buy_date)}
                        </Text>
                      </Paper>
                    )
                  })}
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
      </Stack>
    </Container>
  )
}

export default Dashboard