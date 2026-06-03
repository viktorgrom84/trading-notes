import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Container, Title, Text, Card, Table, Badge, Group, Stack,
  ThemeIcon, Center, Skeleton, SimpleGrid, Tooltip, Alert, Tabs, ActionIcon,
} from '@mantine/core'
import {
  IconChartCandle, IconAlertTriangle, IconCalendarEvent,
  IconCurrencyDollar, IconInfoCircle, IconHistory, IconClock, IconCalendarStats,
  IconExternalLink, IconRefresh,
} from '@tabler/icons-react'
import { useTrades } from '../context/TradesContext'
import { formatCurrency, formatDate, getProfitColor } from '../utils/format'

// ─── helpers ──────────────────────────────────────────────────────────────────
function daysToExpiry(expirationDate) {
  if (!expirationDate) return null
  // Slice to YYYY-MM-DD — handles both plain dates and ISO timestamps from PostgreSQL
  const datePart = String(expirationDate).slice(0, 10)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(datePart + 'T12:00:00') // noon avoids DST edge cases
  if (isNaN(exp.getTime())) return null
  return Math.round((exp - today) / (1000 * 60 * 60 * 24))
}

function expiryBadge(days) {
  if (days === null) return <Badge color="gray"   variant="light">No expiry</Badge>
  if (days < 0)      return <Badge color="gray"   variant="filled">Expired {Math.abs(days)}d ago</Badge>
  if (days === 0)    return <Badge color="red"    variant="filled">Expires TODAY</Badge>
  if (days <= 7)     return <Badge color="orange" variant="filled">{days}d left</Badge>
  if (days <= 30)    return <Badge color="yellow" variant="light">{days}d left</Badge>
  return                    <Badge color="gray"   variant="light">{days}d left</Badge>
}

function calcProfitIfAssigned(trade) {
  const strike    = parseFloat(trade.strike_price)
  const avgCost   = parseFloat(trade.avg_price)
  const contracts = parseInt(trade.shares) || 1
  if (!trade.avg_price && trade.avg_price !== 0) return null
  if (isNaN(strike) || isNaN(avgCost)) return null
  return (strike - avgCost) * contracts * 100
}

// ─── reusable sub-components ──────────────────────────────────────────────────
function SummaryCard({ label, value, icon, color = 'blue' }) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed" fw={500} mb={4}>{label}</Text>
          <Text size="xl" fw={700}>{value}</Text>
        </div>
        <ThemeIcon size="xl" variant="light" color={color}>{icon}</ThemeIcon>
      </Group>
    </Card>
  )
}

function ExpiryGroup({ expDate, days, options: group, navigate, prices, pricesLoading }) {
  const groupPremium   = group.reduce((s, o) => s + (parseFloat(o.buy_price) || 0), 0)
  const groupMoneyInPlay = group.reduce((s, o) => {
    const avg       = parseFloat(o.avg_price)
    const contracts = parseInt(o.shares) || 1
    return isNaN(avg) ? s : s + avg * contracts * 100
  }, 0)
  const isUrgent = days !== null && days >= 0 && days <= 7

  return (
    <Card
      withBorder
      p="xl"
      style={isUrgent ? { borderColor: 'var(--mantine-color-orange-4)' } : undefined}
    >
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <IconCalendarEvent size={20} style={{ color: 'var(--mantine-color-blue-6)' }} />
          <Title order={3}>
            {expDate ? formatDate(expDate) : 'No expiration date'}
          </Title>
          {expiryBadge(days)}
        </Group>
        <Group gap="xl">
          <div style={{ textAlign: 'right' }}>
            <Text size="xs" c="dimmed">Money in play</Text>
            <Text fw={600}>{formatCurrency(groupMoneyInPlay)}</Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text size="xs" c="dimmed">Premium collected</Text>
            <Text fw={600} c="green">{formatCurrency(groupPremium)}</Text>
          </div>
        </Group>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Ticker</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Contracts</Table.Th>
            <Table.Th>Strike</Table.Th>
            <Table.Th>
              <Group gap={4}>
                Avg Price
                <Tooltip label="Your average cost basis per share of the underlying stock" withArrow>
                  <IconInfoCircle size={14} style={{ opacity: 0.5, cursor: 'help' }} />
                </Tooltip>
              </Group>
            </Table.Th>
            <Table.Th>Current</Table.Th>
            <Table.Th>Premium</Table.Th>
            <Table.Th>Opened</Table.Th>
            <Table.Th>
              <Group gap={4}>
                Profit if Assigned
                <Tooltip label="(Strike − Avg Price) × Contracts × 100" withArrow>
                  <IconInfoCircle size={14} style={{ opacity: 0.5, cursor: 'help' }} />
                </Tooltip>
              </Group>
            </Table.Th>
            <Table.Th />
                  </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {group.map(opt => (
            <Table.Tr key={opt.id}>
              <Table.Td><Text fw={700}>{opt.symbol}</Text></Table.Td>
              <Table.Td>
                <Badge
                  color={opt.option_type === 'call' ? 'orange' : 'grape'}
                  variant="light"
                  size="sm"
                >
                  {opt.label}
                </Badge>
              </Table.Td>
              <Table.Td>{opt.shares}</Table.Td>
              <Table.Td>
                <Text fw={500}>${parseFloat(opt.strike_price || 0).toFixed(2)}</Text>
              </Table.Td>
              <Table.Td>
                {opt.avg_price != null
                  ? <Text>${parseFloat(opt.avg_price).toFixed(2)}</Text>
                  : <Text c="dimmed" size="sm">—</Text>
                }
              </Table.Td>
              <Table.Td>
                {pricesLoading ? (
                  <Text c="dimmed" size="sm">…</Text>
                ) : prices[opt.symbol?.toUpperCase()] != null ? (
                  (() => {
                    const cur   = prices[opt.symbol.toUpperCase()]
                    const strike = parseFloat(opt.strike_price)
                    const itm   = opt.option_type === 'call' ? cur > strike : cur < strike
                    return (
                      <Tooltip label={itm ? 'In the money' : 'Out of the money'} withArrow>
                        <Text fw={600} c={itm ? 'red' : 'green'}>
                          ${cur.toFixed(2)}
                        </Text>
                      </Tooltip>
                    )
                  })()
                ) : (
                  <Text c="dimmed" size="sm">—</Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text c="green" fw={500}>{formatCurrency(opt.buy_price)}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">{formatDate(opt.buy_date)}</Text>
              </Table.Td>
                      <Table.Td>
                        {opt.profitIfAssigned !== null ? (
                          <Text fw={700} c={getProfitColor(opt.profitIfAssigned)}>
                            {formatCurrency(opt.profitIfAssigned)}
                          </Text>
                        ) : (
                          <Tooltip label="Enter Avg Stock Price to calculate" withArrow>
                            <Text c="dimmed" size="sm" style={{ cursor: 'help' }}>Need avg price</Text>
                          </Tooltip>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="Open trade" withArrow>
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => navigate(`/trades?id=${opt.id}`)}
                          >
                            <IconExternalLink size={15} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  )
}

function EmptyState({ message }) {
  return (
    <Card withBorder>
      <Center py="xl">
        <Stack align="center" gap="md">
          <ThemeIcon size="xl" variant="light" color="gray">
            <IconChartCandle size={32} />
          </ThemeIcon>
          <Text size="lg" fw={500}>{message}</Text>
        </Stack>
      </Center>
    </Card>
  )
}

function groupByExpiry(options) {
  const map = new Map()
  for (const opt of options) {
    const key = opt.expiration_date ?? null
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(opt)
  }
  return Array.from(map.entries()).map(([expDate, opts]) => ({
    expDate,
    days: opts[0].days,
    options: opts,
  }))
}

// ─── main component ────────────────────────────────────────────────────────────
const VALID_TABS = ['current', 'future', 'past']

export default function OpenOptions() {
  const { trades, loading } = useTrades()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [prices, setPrices]         = useState({})   // { AAPL: 192.34, ... }
  const [pricesLoading, setPricesLoading] = useState(false)

  const activeTab = VALID_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'current'

  const handleTabChange = (tab) => {
    setSearchParams({ tab }, { replace: true })
  }

  // ── price fetching ────────────────────────────────────────────────────────
  const fetchPrices = async (symbolList) => {
    if (!symbolList.length) return
    setPricesLoading(true)
    try {
      const res = await fetch(`/api/market-calendar?type=quotes&symbols=${symbolList.join(',')}`)
      if (res.ok) {
        const data = await res.json()
        setPrices(data.prices ?? {})
      }
    } finally {
      setPricesLoading(false)
    }
  }

  useEffect(() => {
    if (loading) return
    const syms = [...new Set(
      trades
        .filter(t => t.trade_type === 'option' && t.position_type === 'short' && !t.sell_date)
        .map(t => t.symbol?.trim().toUpperCase())
        .filter(Boolean)
    )]
    if (syms.length) fetchPrices(syms)
  }, [loading, trades])

  const { current, future, past, totalPremium } = useMemo(() => {
    const enriched = trades
      .filter(t => t.trade_type === 'option' && t.position_type === 'short' && !t.sell_date)
      .map(t => ({
        ...t,
        days:             daysToExpiry(t.expiration_date),
        profitIfAssigned: calcProfitIfAssigned(t),
        label:            t.option_type === 'call' ? 'Covered Call' : 'Cash-Secured Put',
      }))
      .sort((a, b) => {
        if (a.days === null && b.days === null) return 0
        if (a.days === null) return 1
        if (b.days === null) return -1
        return a.days - b.days
      })

    const current = enriched.filter(o => o.days !== null && o.days >= 0 && o.days <= 7)
    const future  = enriched.filter(o => o.days === null || o.days > 7)
    const past    = enriched.filter(o => o.days !== null && o.days < 0)
      .sort((a, b) => b.days - a.days) // most recently expired first

    const totalPremium = enriched.reduce((s, o) => s + (parseFloat(o.buy_price) || 0), 0)

    return { current, future, past, totalPremium }
  }, [trades])

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <Skeleton height={32} width={300} />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {[0, 1, 2].map(i => <Skeleton key={i} height={100} />)}
          </SimpleGrid>
          <Skeleton height={300} />
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1} mb="sm">Open Options</Title>
            <Text c="dimmed" size="lg">
              Track your active covered calls and cash-secured puts
            </Text>
          </div>
          <Tooltip label="Refresh current prices" withArrow>
            <ActionIcon
              variant="subtle"
              size="lg"
              loading={pricesLoading}
              onClick={() => {
                const syms = [...new Set(
                  trades
                    .filter(t => t.trade_type === 'option' && t.position_type === 'short' && !t.sell_date)
                    .map(t => t.symbol?.trim().toUpperCase())
                    .filter(Boolean)
                )]
                if (syms.length) fetchPrices(syms)
              }}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Alert for options expiring today */}
        {current.some(o => o.days === 0) && (
          <Alert icon={<IconAlertTriangle size={18} />} color="red" title="Expiring TODAY">
            {current.filter(o => o.days === 0).map(o => (
              <Text key={o.id} size="sm">
                <strong>{o.symbol}</strong> {o.label} — Strike ${parseFloat(o.strike_price).toFixed(2)}
              </Text>
            ))}
          </Alert>
        )}

        {/* Summary cards — reflect all open positions */}
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <SummaryCard
            label="Expiring This Week"
            value={current.length}
            icon={<IconCalendarEvent size={24} />}
            color={current.length > 0 ? 'orange' : 'blue'}
          />
          <SummaryCard
            label="Future Expirations"
            value={future.length}
            icon={<IconCalendarStats size={24} />}
            color="blue"
          />
          <SummaryCard
            label="Total Premium Collected"
            value={formatCurrency(totalPremium)}
            icon={<IconCurrencyDollar size={24} />}
            color="green"
          />
        </SimpleGrid>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={handleTabChange} keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab
              value="current"
              leftSection={<IconClock size={16} />}
              rightSection={
                current.length > 0
                  ? <Badge color="orange" variant="filled" size="sm">{current.length}</Badge>
                  : undefined
              }
            >
              Current Week
            </Tabs.Tab>
            <Tabs.Tab
              value="future"
              leftSection={<IconCalendarStats size={16} />}
              rightSection={
                future.length > 0
                  ? <Badge color="blue" variant="light" size="sm">{future.length}</Badge>
                  : undefined
              }
            >
              Future
            </Tabs.Tab>
            <Tabs.Tab
              value="past"
              leftSection={<IconHistory size={16} />}
              rightSection={
                past.length > 0
                  ? <Badge color="gray" variant="light" size="sm">{past.length}</Badge>
                  : undefined
              }
            >
              Past
            </Tabs.Tab>
          </Tabs.List>

          {/* Current week */}
          <Tabs.Panel value="current">
            <Stack gap="lg">
              {current.length > 0
                ? groupByExpiry(current).map(g => <ExpiryGroup key={g.expDate ?? 'none'} {...g} navigate={navigate} prices={prices} pricesLoading={pricesLoading} />)
                : <EmptyState message="No options expiring this week" />
              }
            </Stack>
          </Tabs.Panel>

          {/* Future */}
          <Tabs.Panel value="future">
            <Stack gap="lg">
              {future.length > 0
                ? groupByExpiry(future).map(g => <ExpiryGroup key={g.expDate ?? 'none'} {...g} navigate={navigate} prices={prices} pricesLoading={pricesLoading} />)
                : <EmptyState message="No future expirations" />
              }
            </Stack>
          </Tabs.Panel>

          {/* Past */}
          <Tabs.Panel value="past">
            <Stack gap="lg">
              {past.length > 0
                ? groupByExpiry(past).map(g => <ExpiryGroup key={g.expDate ?? 'none'} {...g} navigate={navigate} prices={prices} pricesLoading={pricesLoading} />)
                : <EmptyState message="No past expirations" />
              }
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  )
}
