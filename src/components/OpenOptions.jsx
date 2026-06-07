import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Container, Title, Text, Card, Table, Badge, Group, Stack,
  ThemeIcon, Center, Skeleton, SimpleGrid, Tooltip, Alert, Tabs, ActionIcon,
  Modal, Button, Divider,
} from '@mantine/core'
import {
  IconChartCandle, IconCalendarEvent,
  IconCurrencyDollar, IconInfoCircle, IconHistory, IconClock, IconCalendarStats,
  IconExternalLink, IconRefresh, IconCheck,
} from '@tabler/icons-react'
import { useTrades } from '../context/TradesContext'
import { formatCurrency, formatDate, getProfitColor, getLocalDateString } from '../utils/format'

// ─── helpers ──────────────────────────────────────────────────────────────────

// Count Mon–Fri trading days between today and the expiration date.
// Returns 0 if today, positive if in the future, negative if in the past.
function daysToExpiry(expirationDate) {
  if (!expirationDate) return null
  const datePart = String(expirationDate).slice(0, 10)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(datePart + 'T12:00:00')
  if (isNaN(exp.getTime())) return null
  exp.setHours(0, 0, 0, 0)

  if (exp.getTime() === today.getTime()) return 0

  const forward = exp > today
  const from = forward ? today : exp
  const to   = forward ? exp   : today

  let count = 0
  const cursor = new Date(from)
  cursor.setDate(cursor.getDate() + 1)
  while (cursor <= to) {
    const dow = cursor.getDay()
    if (dow >= 1 && dow <= 5) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return forward ? count : -count
}

function expiryBadge(days) {
  if (days === null) return <Badge color="gray"   variant="light">No expiry</Badge>
  if (days < 0)      return <Badge color="gray"   variant="filled">Expired {Math.abs(days)}td ago</Badge>
  if (days === 0)    return <Badge color="red"    variant="filled">Expires TODAY</Badge>
  if (days <= 5)     return <Badge color="orange" variant="filled">{days}td left</Badge>
  if (days <= 21)    return <Badge color="yellow" variant="light">{days}td left</Badge>
  return                    <Badge color="gray"   variant="light">{days}td left</Badge>
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

// ─── Assignment confirmation modal ────────────────────────────────────────────
function AssignmentModal({ opt, onConfirm, onClose }) {
  const strike         = parseFloat(opt.strike_price)
  const contracts      = parseInt(opt.shares) || 1
  const premium        = parseFloat(opt.buy_price) || 0
  const profitIfAssigned = calcProfitIfAssigned(opt)
  const totalPL        = profitIfAssigned != null ? premium + profitIfAssigned : null

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Text fw={700} size="lg">Mark as Assigned — {opt.symbol}</Text>}
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Your <strong>{contracts} contract{contracts > 1 ? 's' : ''}</strong> covered call
          (strike <strong>${strike.toFixed(2)}</strong>) was assigned — shares called away at the strike price.
        </Text>

        <Divider />

        <Group justify="space-between">
          <Text size="sm">Premium kept (full)</Text>
          <Text fw={600} c="green">{formatCurrency(premium)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Stock gain/loss on assignment</Text>
          {profitIfAssigned != null
            ? <Text fw={600} c={getProfitColor(profitIfAssigned)}>{formatCurrency(profitIfAssigned)}</Text>
            : <Text size="sm" c="dimmed">Enter Avg Price to calculate</Text>
          }
        </Group>
        {totalPL != null && (
          <Group justify="space-between">
            <Text fw={700}>Total assignment P&L</Text>
            <Text fw={700} size="lg" c={getProfitColor(totalPL)}>{formatCurrency(totalPL)}</Text>
          </Group>
        )}

        <Divider />

        <Alert color="blue" variant="light">
          <Text size="sm">
            The option row will turn <strong>green</strong> to mark it as assigned.
            You'll be taken to Trading Notes with a profit-only entry pre-filled for the stock gain/loss of <strong>{formatCurrency(profitIfAssigned ?? 0)}</strong>.
          </Text>
        </Alert>

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="orange" onClick={onConfirm} leftSection={<IconCheck size={16} />}>
            Confirm Assignment
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function ExpiryGroup({ expDate, days, options: group, navigate, quotes, quotesLoading, onAssign, assignedIds }) {
  const groupPremium   = group.reduce((s, o) => s + (parseFloat(o.buy_price) || 0), 0)
  const groupMoneyInPlay = group.reduce((s, o) => {
    const avg       = parseFloat(o.avg_price)
    const contracts = parseInt(o.shares) || 1
    return isNaN(avg) ? s : s + avg * contracts * 100
  }, 0)
  const isUrgent = days !== null && days >= 0 && days <= 5

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
            <Table.Th>
              <Group gap={4}>
                30d HV
                <Tooltip label="30-day Historical Volatility (annualised). Higher = stock moves more. >60% is elevated — usually means more premium available." withArrow>
                  <IconInfoCircle size={14} style={{ opacity: 0.5, cursor: 'help' }} />
                </Tooltip>
              </Group>
            </Table.Th>
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
            <Table.Tr
              key={opt.id}
              style={assignedIds?.has(opt.id)
                ? { backgroundColor: 'rgba(34, 197, 94, 0.15)' }
                : undefined}
            >
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
                {(() => {
                  const raw    = quotes[opt.symbol?.toUpperCase()]
                  // Support both old API (plain number) and new API ({ price, hv })
                  const curPrice = typeof raw === 'object' ? raw?.price : (typeof raw === 'number' ? raw : null)
                  if (quotesLoading) return <Text c="dimmed" size="sm">…</Text>
                  if (curPrice == null) return <Text c="dimmed" size="sm">—</Text>
                  const strike = parseFloat(opt.strike_price)
                  const itm    = opt.option_type === 'call' ? curPrice > strike : curPrice < strike
                  return (
                    <Tooltip label={itm ? 'In the money' : 'Out of the money'} withArrow>
                      <Text fw={600} c={itm ? 'red' : 'green'}>${curPrice.toFixed(2)}</Text>
                    </Tooltip>
                  )
                })()}
              </Table.Td>
              <Table.Td>
                {(() => {
                  const q = quotes[opt.symbol?.toUpperCase()]
                  if (quotesLoading) return <Text c="dimmed" size="sm">…</Text>
                  if (q?.hv == null) return <Text c="dimmed" size="sm">—</Text>
                  const color = q.hv >= 60 ? 'green' : q.hv >= 40 ? 'yellow' : 'dimmed'
                  return (
                    <Tooltip label={`30d HV: ${q.hv}% — ${q.hv >= 60 ? 'elevated (good for selling premium)' : q.hv >= 40 ? 'moderate' : 'low'}`} withArrow>
                      <Text fw={500} c={color}>{q.hv}%</Text>
                    </Tooltip>
                  )
                })()}
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
                        <Group gap={4} wrap="nowrap">
                          {assignedIds?.has(opt.id) ? (
                            <Badge color="green" variant="light" size="sm">Assigned</Badge>
                          ) : opt.option_type === 'call' ? (
                            <Tooltip label="Mark as Assigned — shares called away at strike" withArrow>
                              <ActionIcon
                                variant="light"
                                color="orange"
                                onClick={() => onAssign(opt)}
                              >
                                <IconCheck size={15} />
                              </ActionIcon>
                            </Tooltip>
                          ) : null}
                          <Tooltip label="Open trade" withArrow>
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => navigate(`/trades?id=${opt.id}&returnTo=/options`)}
                            >
                              <IconExternalLink size={15} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
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
  // quotes: { AAPL: { price: 185.5, hv: 35 }, ... }
  const [quotes, setQuotes]               = useState({})
  const [quotesLoading, setQuotesLoading] = useState(false)
  // assignment — stored in localStorage so it survives navigation
  const [assignTarget, setAssignTarget] = useState(null)
  const [assignedIds, setAssignedIds]   = useState(() => {
    try {
      const saved = localStorage.getItem('assignedOptionIds')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })

  const activeTab = VALID_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'current'

  const handleTabChange = (tab) => {
    setSearchParams({ tab }, { replace: true })
  }

  // ── price + IV fetching ───────────────────────────────────────────────────
  const fetchQuotes = async (symbolList) => {
    if (!symbolList.length) return
    setQuotesLoading(true)
    try {
      const res = await fetch(`/api/market-calendar?type=quotes&symbols=${symbolList.join(',')}`)
      if (res.ok) {
        const data = await res.json()
        setQuotes(data.prices ?? {})
      }
    } finally {
      setQuotesLoading(false)
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
    if (syms.length) fetchQuotes(syms)
  }, [loading, trades])

  // ── assignment ────────────────────────────────────────────────────────────
  // No API call — row turns green locally, then navigates to a pre-filled
  // profit-only form in Trading Notes so the user can record the stock P&L.
  const handleAssign = (opt) => {
    const newSet = new Set([...assignedIds, opt.id])
    setAssignedIds(newSet)
    try { localStorage.setItem('assignedOptionIds', JSON.stringify([...newSet])) } catch {}
    setAssignTarget(null)
    const today  = getLocalDateString(new Date())
    const profit = opt.profitIfAssigned ?? 0
    navigate(`/trades?prefill=profit_only&symbol=${encodeURIComponent(opt.symbol)}&profit=${profit}&date=${today}`)
  }

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

    const current = enriched.filter(o => o.days !== null && o.days >= 0 && o.days <= 5)
    const future  = enriched.filter(o => o.days === null || o.days > 5)
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
          <Tooltip label="Refresh prices & IV" withArrow>
            <ActionIcon
              variant="subtle"
              size="lg"
              loading={quotesLoading}
              onClick={() => {
                const syms = [...new Set(
                  trades
                    .filter(t => t.trade_type === 'option' && t.position_type === 'short' && !t.sell_date)
                    .map(t => t.symbol?.trim().toUpperCase())
                    .filter(Boolean)
                )]
                if (syms.length) fetchQuotes(syms)
              }}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

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

        {/* Assignment confirmation modal */}
        {assignTarget && (
          <AssignmentModal
            opt={assignTarget}
            onConfirm={() => handleAssign(assignTarget)}
            onClose={() => setAssignTarget(null)}
          />
        )}

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
                ? groupByExpiry(current).map(g => <ExpiryGroup key={g.expDate ?? 'none'} {...g} navigate={navigate} quotes={quotes} quotesLoading={quotesLoading} onAssign={setAssignTarget} assignedIds={assignedIds} />)
                : <EmptyState message="No options expiring this week" />
              }
            </Stack>
          </Tabs.Panel>

          {/* Future */}
          <Tabs.Panel value="future">
            <Stack gap="lg">
              {future.length > 0
                ? groupByExpiry(future).map(g => <ExpiryGroup key={g.expDate ?? 'none'} {...g} navigate={navigate} quotes={quotes} quotesLoading={quotesLoading} onAssign={setAssignTarget} assignedIds={assignedIds} />)
                : <EmptyState message="No future expirations" />
              }
            </Stack>
          </Tabs.Panel>

          {/* Past */}
          <Tabs.Panel value="past">
            <Stack gap="lg">
              {past.length > 0
                ? groupByExpiry(past).map(g => <ExpiryGroup key={g.expDate ?? 'none'} {...g} navigate={navigate} quotes={quotes} quotesLoading={quotesLoading} onAssign={setAssignTarget} assignedIds={assignedIds} />)
                : <EmptyState message="No past expirations" />
              }
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  )
}
