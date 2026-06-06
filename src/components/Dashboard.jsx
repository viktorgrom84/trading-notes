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
  SimpleGrid,
  Paper,
  Title,
  ActionIcon,
  Modal,
  NumberInput,
  Progress,
  RingProgress
} from '@mantine/core'
import { 
  IconPlus, 
  IconTrendingUp, 
  IconTrendingDown, 
  IconCurrencyDollar, 
  IconChartBar,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  IconCalendar,
  IconTarget,
  IconEdit
} from '@tabler/icons-react'
import apiClient from '../api'
import { useTrades } from '../context/TradesContext'
import { checkAdminAccess } from '../utils/admin'
import { formatCurrency, formatDate, getLocalDateString, getProfitColor } from '../utils/format'
import { tradeProfit } from '../utils/tradeProfit'

const Dashboard = ({ user }) => {
  const { trades: allTrades, loading } = useTrades()
  const recentTrades = allTrades.slice(0, 5)
  const isPerformanceUser = checkAdminAccess(user)

  const [stats, setStats] = useState({
    totalTrades: 0,
    totalProfit: 0,
    winRate: 0,
    avgProfit: 0,
  })
  const [performanceTarget, setPerformanceTarget] = useState(0)
  const [currentPerformance, setCurrentPerformance] = useState(0)
  const [showTargetModal, setShowTargetModal] = useState(false)
  const [yearlyGoal, setYearlyGoal] = useState(0)
  const [goalInput, setGoalInput] = useState(0)
  const [showGoalModal, setShowGoalModal] = useState(false)

  const loadStatistics = useCallback(async () => {
    try {
      const statistics = await apiClient.getStatistics()
      setStats(statistics)
    } catch (error) {
      console.error('Error loading statistics:', error)
    }
  }, [])

  useEffect(() => {
    loadStatistics()
    loadPerformanceTarget()
    loadYearlyGoal()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadStatistics])

  const loadPerformanceTarget = useCallback(async () => {
    try {
      const settings = await apiClient.getSettings()
      if (settings.performanceTarget) {
        setPerformanceTarget(parseFloat(settings.performanceTarget))
      } else {
        // DB has no value yet — migrate from localStorage if present
        const saved = localStorage.getItem('performanceTarget')
        if (saved) {
          const val = parseFloat(saved)
          setPerformanceTarget(val)
          try { await apiClient.setSetting('performanceTarget', val.toString()) } catch {}
        }
      }
    } catch (error) {
      console.error('Failed to load performance target:', error)
      const saved = localStorage.getItem('performanceTarget')
      if (saved) setPerformanceTarget(parseFloat(saved))
    }
  }, [])

  const savePerformanceTarget = useCallback(async (target) => {
    try {
      await apiClient.setSetting('performanceTarget', target.toString())
      setPerformanceTarget(target)
      // Also save to localStorage as backup
      localStorage.setItem('performanceTarget', target.toString())
    } catch (error) {
      console.error('Failed to save performance target:', error)
      // Fallback to localStorage
      setPerformanceTarget(target)
      localStorage.setItem('performanceTarget', target.toString())
    }
  }, [])

  const loadYearlyGoal = useCallback(async () => {
    try {
      const settings = await apiClient.getSettings()
      if (settings.yearlyGoal) {
        const val = parseFloat(settings.yearlyGoal)
        setYearlyGoal(val)
        setGoalInput(val)
      } else {
        // DB has no value yet — migrate from localStorage if present
        const saved = localStorage.getItem('yearlyGoal')
        if (saved) {
          const val = parseFloat(saved)
          setYearlyGoal(val)
          setGoalInput(val)
          try { await apiClient.setSetting('yearlyGoal', val.toString()) } catch {}
        }
      }
    } catch {
      const saved = localStorage.getItem('yearlyGoal')
      if (saved) {
        const val = parseFloat(saved)
        setYearlyGoal(val)
        setGoalInput(val)
      }
    }
  }, [])

  const saveYearlyGoal = useCallback(async (goal) => {
    try {
      await apiClient.setSetting('yearlyGoal', goal.toString())
      setYearlyGoal(goal)
      setGoalInput(goal)
      localStorage.setItem('yearlyGoal', goal.toString())
    } catch {
      setYearlyGoal(goal)
      setGoalInput(goal)
      localStorage.setItem('yearlyGoal', goal.toString())
    }
  }, [])

  // Calculate current performance based on target + total profit
  const calculatedPerformance = useMemo(() => {
    return performanceTarget + stats.totalProfit
  }, [performanceTarget, stats.totalProfit])

  const getProfitIcon = useCallback((profit) => {
    if (profit > 0) return <IconArrowUpRight size={16} />
    if (profit < 0) return <IconArrowDownRight size={16} />
    return <IconMinus size={16} />
  }, [])

  const { performanceThisMonth, performanceThisYear } = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-indexed

    let month = 0
    let year = 0

    allTrades.forEach(trade => {
      const isOption = trade.trade_type === 'option'
      const dateStr = isOption ? trade.buy_date : trade.sell_date
      if (!dateStr) return
      const profit = tradeProfit(trade)
      if (profit === null) return

      const [y, m] = getLocalDateString(dateStr).split('-').map(Number)
      if (y === currentYear) {
        year += profit
        if (m - 1 === currentMonth) month += profit
      }
    })

    return {
      performanceThisMonth: Math.round(month * 100) / 100,
      performanceThisYear: Math.round(year * 100) / 100,
    }
  }, [allTrades])

  const StatCard = useCallback(({ title, value, icon, color = 'blue' }) => (
    <Card withBorder radius="md" p="xl">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed" fw={500}>
            {title}
          </Text>
          <Text size="xl" fw={700} c={getProfitColor(value)}>
            {title === 'Total Trades' || title === 'Win Rate %' ? value : formatCurrency(typeof value === 'number' ? value : 0)}
          </Text>
        </div>
        <ThemeIcon size="xl" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [getProfitColor, formatCurrency])

  const processedRecentTrades = useMemo(() => {
    return recentTrades.map((trade) => {
      const isProfitOnlyTrade = trade.shares === 1 && trade.buy_price === 0 &&
                               trade.buy_date === trade.sell_date &&
                               trade.notes && trade.notes.includes('Profit-only trade')
      const profit = tradeProfit(trade)
      return { ...trade, isProfitOnlyTrade, profit }
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

        {/* Performance Tracker — visible only to admin */}
        {isPerformanceUser && <Card withBorder radius="md" p="xl" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
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
              onClick={() => { setCurrentPerformance(performanceTarget); setShowTargetModal(true) }}
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
        </Card>}

        {/* Yearly Goal Banner */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size="lg" variant="light" color="violet">
                <IconTarget size={18} />
              </ThemeIcon>
              <div>
                {yearlyGoal > 0 ? (
                  <>
                    <Text fw={600} size="sm">Yearly Goal: {formatCurrency(yearlyGoal)}</Text>
                    <Text size="xs" c="dimmed">{formatCurrency(yearlyGoal / 12)} / month</Text>
                  </>
                ) : (
                  <>
                    <Text fw={600} size="sm">No yearly goal set</Text>
                    <Text size="xs" c="dimmed">Set a goal to track monthly & yearly progress</Text>
                  </>
                )}
              </div>
            </Group>
            <Button
              variant="light"
              color="violet"
              size="xs"
              leftSection={yearlyGoal > 0 ? <IconEdit size={14} /> : <IconTarget size={14} />}
              onClick={() => setShowGoalModal(true)}
            >
              {yearlyGoal > 0 ? 'Edit Goal' : 'Set Goal'}
            </Button>
          </Group>
        </Card>

        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
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
            color={Number(stats.winRate) >= 65 ? 'green' : 'red'}
          />
          <StatCard
            title="Avg Profit"
            value={stats.avgProfitPerTrade || 0}
            icon={<IconTrendingDown size={24} />}
            color={(stats.avgProfitPerTrade || 0) >= 0 ? 'green' : 'red'}
          />

          {/* Performance This Month — goal-aware */}
          {yearlyGoal > 0 ? (() => {
            const monthlyGoal = yearlyGoal / 12
            const pct = Math.min(Math.max((performanceThisMonth / monthlyGoal) * 100, 0), 100)
            const remaining = monthlyGoal - performanceThisMonth
            const over = performanceThisMonth > monthlyGoal
            return (
              <Card withBorder radius="md" p="xl">
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text size="sm" c="dimmed" fw={500}>Performance This Month</Text>
                    <Text size="xl" fw={700} c={getProfitColor(performanceThisMonth)}>
                      {formatCurrency(performanceThisMonth)}
                    </Text>
                  </div>
                  <RingProgress
                    size={56}
                    thickness={5}
                    sections={[{ value: pct, color: over ? 'green' : performanceThisMonth < 0 ? 'red' : 'blue' }]}
                    label={
                      <Text ta="center" size="9px" fw={700} c={over ? 'green' : 'dimmed'}>
                        {Math.round(pct)}%
                      </Text>
                    }
                  />
                </Group>
                <Progress
                  value={pct}
                  color={over ? 'green' : performanceThisMonth < 0 ? 'red' : 'blue'}
                  size="sm"
                  radius="xl"
                  mb={6}
                />
                <Text size="xs" c={over ? 'green' : 'dimmed'}>
                  {over
                    ? `+${formatCurrency(performanceThisMonth - monthlyGoal)} above goal`
                    : `${formatCurrency(remaining)} remaining of ${formatCurrency(monthlyGoal)}`}
                </Text>
              </Card>
            )
          })() : (
            <StatCard
              title="Performance This Month"
              value={performanceThisMonth}
              icon={<IconCalendar size={24} />}
              color={performanceThisMonth >= 0 ? 'green' : 'red'}
            />
          )}

          {/* Performance This Year — goal-aware */}
          {yearlyGoal > 0 ? (() => {
            const pct = Math.min(Math.max((performanceThisYear / yearlyGoal) * 100, 0), 100)
            const remaining = yearlyGoal - performanceThisYear
            const over = performanceThisYear > yearlyGoal
            return (
              <Card withBorder radius="md" p="xl">
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text size="sm" c="dimmed" fw={500}>Performance This Year</Text>
                    <Text size="xl" fw={700} c={getProfitColor(performanceThisYear)}>
                      {formatCurrency(performanceThisYear)}
                    </Text>
                  </div>
                  <RingProgress
                    size={56}
                    thickness={5}
                    sections={[{ value: pct, color: over ? 'green' : performanceThisYear < 0 ? 'red' : 'blue' }]}
                    label={
                      <Text ta="center" size="9px" fw={700} c={over ? 'green' : 'dimmed'}>
                        {Math.round(pct)}%
                      </Text>
                    }
                  />
                </Group>
                <Progress
                  value={pct}
                  color={over ? 'green' : performanceThisYear < 0 ? 'red' : 'blue'}
                  size="sm"
                  radius="xl"
                  mb={6}
                />
                <Text size="xs" c={over ? 'green' : 'dimmed'}>
                  {over
                    ? `+${formatCurrency(performanceThisYear - yearlyGoal)} above goal`
                    : `${formatCurrency(remaining)} remaining of ${formatCurrency(yearlyGoal)}`}
                </Text>
              </Card>
            )
          })() : (
            <StatCard
              title="Performance This Year"
              value={performanceThisYear}
              icon={<IconCalendar size={24} />}
              color={performanceThisYear >= 0 ? 'green' : 'red'}
            />
          )}
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
                            color={trade.trade_type === 'option' ? 'orange' : trade.sell_price && trade.sell_date ? 'gray' : 'blue'}
                            variant="light"
                          >
                            {trade.trade_type === 'option' ? 'Option' : trade.sell_price && trade.sell_date ? 'Closed' : 'Open'}
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
                        ) : trade.trade_type === 'option' ? (
                          `${trade.shares} contract${trade.shares !== 1 ? 's' : ''} • ${trade.option_type === 'call' ? 'Covered Call' : 'Put'} • Strike $${parseFloat(trade.strike_price || 0).toFixed(0)} • ${formatDate(trade.buy_date)}`
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

        {/* Yearly Goal Modal — available to all users */}
        <Modal
          opened={showGoalModal}
          onClose={() => setShowGoalModal(false)}
          title="Set Yearly Goal"
          size="md"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Set your yearly profit goal. For example, a $12,000 goal means $1,000 per month. Your Performance This Month and This Year cards will show your progress.
            </Text>
            <NumberInput
              label="Yearly Goal"
              description={goalInput > 0 ? `Monthly target: ${formatCurrency(goalInput / 12)}` : undefined}
              placeholder="e.g. 12000"
              value={goalInput}
              onChange={(value) => setGoalInput(value || 0)}
              prefix="$"
              thousandSeparator=","
              decimalScale={2}
              min={0}
              size="lg"
            />
            <Group justify="flex-end" gap="sm">
              <Button variant="outline" onClick={() => setShowGoalModal(false)}>
                Cancel
              </Button>
              {yearlyGoal > 0 && (
                <Button
                  color="red"
                  variant="subtle"
                  onClick={() => { saveYearlyGoal(0); setShowGoalModal(false) }}
                >
                  Remove Goal
                </Button>
              )}
              <Button
                onClick={() => { saveYearlyGoal(goalInput); setShowGoalModal(false) }}
                disabled={goalInput <= 0}
              >
                Save Goal
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Performance Target Modal — visible only to admin */}
        {isPerformanceUser && <Modal
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
              value={currentPerformance}
              onChange={(value) => setCurrentPerformance(value ?? 0)}
              prefix="$"
              thousandSeparator=","
              decimalScale={2}
              size="lg"
            />
            
            <Text size="sm" c="dimmed">
              Current calculation: {formatCurrency(currentPerformance)} + {formatCurrency(stats.totalProfit)} = {formatCurrency(currentPerformance + stats.totalProfit)}
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
        </Modal>}
      </Stack>
    </Container>
  )
}

export default Dashboard