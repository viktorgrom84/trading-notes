import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Container, Title, Text, Card, Table, Badge, Group, Stack,
  ThemeIcon, Center, Skeleton, SimpleGrid, Tooltip, Alert, Tabs, ActionIcon,
  Modal, Button, Divider, UnstyledButton, TextInput, Progress, RingProgress,
} from '@mantine/core'
import {
  IconChartCandle, IconCalendarEvent,
  IconCurrencyDollar, IconInfoCircle, IconHistory, IconClock, IconCalendarStats,
  IconExternalLink, IconRefresh, IconCheck, IconSelector, IconChevronUp, IconChevronDown,
  IconFlame, IconPlus, IconX, IconRadar, IconAlertCircle, IconTrendingUp,
} from '@tabler/icons-react'
import { useTrades } from '../context/TradesContext'
import { formatCurrency, formatDate, getProfitColor, getLocalDateString } from '../utils/format'
import { daysToExpiry, calcPremiumYield, calcProfitIfAssigned } from '../utils/options'
import { scoreLabel } from '../utils/scanner'

// ─── helpers ──────────────────────────────────────────────────────────────────

const SCAN_CACHE_KEY   = 'scannerCache'
const SCAN_HISTORY_KEY = 'scannerHistory'

function timeAgo(isoString) {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Reusable sortable column header — must live at module level to avoid React remount on every parent render. */
function SortTh({ col, label, tooltip, sort, onSort }) {
  const Icon = sort.col !== col
    ? <IconSelector size={13} style={{ opacity: 0.35 }} />
    : sort.dir === 'asc' ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />
  return (
    <Table.Th style={{ cursor: 'pointer', userSelect: 'none' }}>
      <UnstyledButton onClick={() => onSort(col)}>
        <Group gap={4} wrap="nowrap">
          {tooltip ? (
            <Tooltip label={tooltip} withArrow>
              <Group gap={4} wrap="nowrap">
                <Text fw={600} size="sm">{label}</Text>
                <IconInfoCircle size={14} style={{ opacity: 0.5, cursor: 'help' }} />
              </Group>
            </Tooltip>
          ) : (
            <Text fw={600} size="sm">{label}</Text>
          )}
          {Icon}
        </Group>
      </UnstyledButton>
    </Table.Th>
  )
}

function expiryBadge(days) {
  if (days === null) return <Badge color="gray"   variant="light">No expiry</Badge>
  if (days < 0)      return <Badge color="gray"   variant="filled">Expired</Badge>
  if (days === 0)    return <Badge color="red"    variant="filled">Expires TODAY</Badge>
  if (days <= 5)     return <Badge color="orange" variant="filled">{days}td left</Badge>
  if (days <= 21)    return <Badge color="yellow" variant="light">{days}td left</Badge>
  return                    <Badge color="gray"   variant="light">{days}td left</Badge>
}

// ─── reusable sub-components ──────────────────────────────────────────────────
function SummaryCard({ label, value, subValue, icon, color = 'blue' }) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed" fw={500} mb={4}>{label}</Text>
          <Group gap={6} align="baseline">
            <Text size="xl" fw={700}>{value}</Text>
            {subValue && <Text size="sm" c="dimmed">({subValue})</Text>}
          </Group>
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

  const [sort, setSort] = useState({ col: 'symbol', dir: 'asc' })
  const toggleSort = useCallback((col) => setSort(s => ({
    col,
    dir: s.col === col ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc',
  })), [])

  const sortedGroup = useMemo(() => [...group].sort((a, b) => {
    const { col, dir } = sort
    let av, bv
    switch (col) {
      case 'symbol':           av = a.symbol ?? '';                  bv = b.symbol ?? '';                  break
      case 'option_type':      av = a.label  ?? '';                  bv = b.label  ?? '';                  break
      case 'shares':           av = parseInt(a.shares)  || 0;        bv = parseInt(b.shares)  || 0;        break
      case 'strike_price':     av = parseFloat(a.strike_price) || 0; bv = parseFloat(b.strike_price) || 0; break
      case 'avg_price':        av = parseFloat(a.avg_price) || 0;    bv = parseFloat(b.avg_price) || 0;    break
      case 'buy_price':        av = parseFloat(a.buy_price) || 0;    bv = parseFloat(b.buy_price) || 0;    break
      case 'yield':            av = a.yield ?? -Infinity;            bv = b.yield ?? -Infinity;            break
      case 'buy_date':         av = a.buy_date ?? '';                bv = b.buy_date ?? '';                break
      case 'profitIfAssigned': av = a.profitIfAssigned ?? -Infinity; bv = b.profitIfAssigned ?? -Infinity; break
      default:                 av = 0; bv = 0
    }
    if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return dir === 'asc' ? av - bv : bv - av
  }), [group, sort])

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
            <SortTh col="symbol"           label="Ticker"             sort={sort} onSort={toggleSort} />
            <SortTh col="option_type"      label="Type"               sort={sort} onSort={toggleSort} />
            <SortTh col="shares"           label="Contracts"          sort={sort} onSort={toggleSort} />
            <SortTh col="strike_price"     label="Strike"             sort={sort} onSort={toggleSort} />
            <SortTh col="avg_price"        label="Avg Price"          sort={sort} onSort={toggleSort} tooltip="Your average cost basis per share of the underlying stock" />
            <Table.Th>Current</Table.Th>
            <Table.Th>
              <Group gap={4}>
                30d HV
                <Tooltip label="30-day Historical Volatility (annualised). Higher = stock moves more. >60% is elevated — usually means more premium available." withArrow>
                  <IconInfoCircle size={14} style={{ opacity: 0.5, cursor: 'help' }} />
                </Tooltip>
              </Group>
            </Table.Th>
            <SortTh col="buy_price"        label="Premium"            sort={sort} onSort={toggleSort} />
            <SortTh col="yield"            label="Yield %"            sort={sort} onSort={toggleSort} tooltip="Premium ÷ (Avg Price × Contracts × 100) — return on capital deployed" />
            <SortTh col="buy_date"         label="Opened"             sort={sort} onSort={toggleSort} />
            <SortTh col="profitIfAssigned" label="Profit if Assigned" sort={sort} onSort={toggleSort} tooltip="(Strike − Avg Price) × Contracts × 100" />
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedGroup.map(opt => (
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
                {opt.yield != null
                  ? <Text fw={600} c={opt.yield >= 3 ? 'green' : opt.yield >= 1 ? 'yellow' : 'dimmed'}>{opt.yield.toFixed(2)}%</Text>
                  : <Text c="dimmed" size="sm">—</Text>
                }
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
const VALID_TABS = ['current', 'future', 'past', 'performance', 'volatility', 'scanner']

export default function OpenOptions() {
  const { trades, loading } = useTrades()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // quotes: { AAPL: { price: 185.5, hv: 35 }, ... }
  const [quotes, setQuotes]               = useState({})
  const [quotesLoading, setQuotesLoading] = useState(false)
  // volatility watchlist — tickers added manually, persisted in localStorage
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('volWatchlist')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [watchlistInput, setWatchlistInput] = useState('')
  // scanner watchlist — independent from the volatility watchlist
  const [scannerWatchlist, setScannerWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('scannerWatchlist')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [scannerInput, setScannerInput] = useState('')
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

  const addToWatchlist = (raw) => {
    const sym = raw.trim().toUpperCase()
    if (!sym || watchlist.includes(sym)) return
    const next = [...watchlist, sym]
    setWatchlist(next)
    try { localStorage.setItem('volWatchlist', JSON.stringify(next)) } catch {}
    setWatchlistInput('')
    fetchQuotes([...new Set([
      ...trades.map(t => t.symbol?.trim().toUpperCase()).filter(Boolean),
      ...next,
    ])])
  }

  const removeFromWatchlist = (sym) => {
    const next = watchlist.filter(s => s !== sym)
    setWatchlist(next)
    try { localStorage.setItem('volWatchlist', JSON.stringify(next)) } catch {}
  }

  useEffect(() => {
    if (loading) return
    const syms = [...new Set([
      ...trades.map(t => t.symbol?.trim().toUpperCase()).filter(Boolean),
      ...watchlist,
    ])]
    if (syms.length) fetchQuotes(syms)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const { current, future, past, totalPremium, currentUnique, futureUnique, pastUnique } = useMemo(() => {
    const enriched = trades
      .filter(t => t.trade_type === 'option' && t.position_type === 'short' && !t.sell_date)
      .map(t => ({
        ...t,
        days:             daysToExpiry(t.expiration_date),
        profitIfAssigned: calcProfitIfAssigned(t),
        yield:            calcPremiumYield(t),
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

    const uniq = arr => new Set(arr.map(o => o.symbol?.toUpperCase()).filter(Boolean)).size
    return {
      current, future, past, totalPremium,
      currentUnique: uniq(current),
      futureUnique:  uniq(future),
      pastUnique:    uniq(past),
    }
  }, [trades])

  const [perfSort, setPerfSort] = useState({ col: 'avgYield', dir: 'desc' })
  const togglePerfSort = (col) => setPerfSort(s => ({
    col,
    dir: s.col === col ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc',
  }))
  const PerfSortIcon = ({ col }) => {
    if (perfSort.col !== col) return <IconSelector size={14} style={{ opacity: 0.4 }} />
    return perfSort.dir === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
  }

  const performanceData = useMemo(() => {
    const shortOptions = trades.filter(t => t.trade_type === 'option' && t.position_type === 'short')
    const byTicker = {}
    for (const t of shortOptions) {
      const sym = t.symbol
      if (!byTicker[sym]) byTicker[sym] = { symbol: sym, count: 0, totalPremium: 0, yields: [] }
      byTicker[sym].count       += 1
      byTicker[sym].totalPremium += parseFloat(t.buy_price) || 0
      const y = calcPremiumYield(t)
      if (y !== null) byTicker[sym].yields.push(y)
    }
    return Object.values(byTicker)
      .map(d => ({
        ...d,
        avgYield:   d.yields.length ? d.yields.reduce((s, y) => s + y, 0) / d.yields.length : null,
        bestYield:  d.yields.length ? Math.max(...d.yields) : null,
        worstYield: d.yields.length ? Math.min(...d.yields) : null,
      }))
      .sort((a, b) => (b.avgYield ?? -Infinity) - (a.avgYield ?? -Infinity))
  }, [trades])

  const sortedPerformanceData = useMemo(() => {
    const { col, dir } = perfSort
    return [...performanceData].sort((a, b) => {
      const av = a[col] ?? (col === 'symbol' ? '' : -Infinity)
      const bv = b[col] ?? (col === 'symbol' ? '' : -Infinity)
      if (col === 'symbol') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return dir === 'asc' ? av - bv : bv - av
    })
  }, [performanceData, perfSort])

  const [volSort, setVolSort] = useState({ col: 'hv', dir: 'desc' })
  const toggleVolSort = (col) => setVolSort(s => ({
    col,
    dir: s.col === col ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc',
  }))
  const VolSortIcon = ({ col }) => {
    if (volSort.col !== col) return <IconSelector size={14} style={{ opacity: 0.4 }} />
    return volSort.dir === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
  }

  const portfolioSymbols = useMemo(() =>
    new Set(trades.map(t => t.symbol?.trim().toUpperCase()).filter(Boolean))
  , [trades])

  const volatilityData = useMemo(() => {
    const tradeCountBySymbol = {}
    const openCountBySymbol  = {}
    for (const t of trades) {
      const sym = t.symbol?.trim().toUpperCase()
      if (!sym) continue
      tradeCountBySymbol[sym] = (tradeCountBySymbol[sym] || 0) + 1
      if (t.trade_type === 'option' && t.position_type === 'short' && !t.sell_date)
        openCountBySymbol[sym] = (openCountBySymbol[sym] || 0) + 1
    }
    return Object.entries(quotes)
      .map(([sym, q]) => ({
        symbol:      sym,
        price:       typeof q === 'object' ? q.price : (typeof q === 'number' ? q : null),
        hv:          typeof q === 'object' ? q.hv    : null,
        totalTrades: tradeCountBySymbol[sym] ?? 0,
        openOptions: openCountBySymbol[sym]  ?? 0,
        inPortfolio: portfolioSymbols.has(sym),
        watchlisted: watchlist.includes(sym),
      }))
      .filter(r => r.hv != null)
  }, [quotes, trades, watchlist, portfolioSymbols])

  // ── Scanner ──────────────────────────────────────────────────────────────────
  // scanResults: { [symbol]: { loading, error, data } }
  const [scanResults, setScanResults]       = useState({})
  const [scanTriggered, setScanTriggered]   = useState(false)
  const [scanLastAt, setScanLastAt]         = useState(null)
  // history: { [symbol]: Array<{ scannedAt, score, price, rsi, hv, pcRatio }> }
  const [scanHistory, setScanHistory]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY) || '{}') } catch { return {} }
  })

  // Restore last scan from cache so results survive navigation
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCAN_CACHE_KEY)
      if (!raw) return
      const { scannedAt, results } = JSON.parse(raw)
      const restored = Object.fromEntries(
        Object.entries(results).map(([sym, data]) => [sym, { loading: false, error: null, data }])
      )
      setScanResults(restored)
      setScanTriggered(true)
      setScanLastAt(scannedAt)
    } catch {}
  }, [])

  const addToScannerWatchlist = useCallback((raw) => {
    const sym = raw.trim().toUpperCase()
    if (!sym) return
    setScannerWatchlist(prev => {
      if (prev.includes(sym)) return prev
      const next = [...prev, sym]
      try { localStorage.setItem('scannerWatchlist', JSON.stringify(next)) } catch {}
      return next
    })
    setScannerInput('')
  }, [])

  const removeFromScannerWatchlist = useCallback((sym) => {
    setScannerWatchlist(prev => {
      const next = prev.filter(s => s !== sym)
      try { localStorage.setItem('scannerWatchlist', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // open short options auto-included; scannerWatchlist adds extras
  const openPositionSymbols = useMemo(() =>
    [...new Set(
      trades
        .filter(t => t.trade_type === 'option' && t.position_type === 'short' && !t.sell_date)
        .map(t => t.symbol?.trim().toUpperCase()).filter(Boolean)
    )],
  [trades])

  const scanSymbols = useMemo(() =>
    [...new Set([...scannerWatchlist, ...openPositionSymbols])],
  [scannerWatchlist, openPositionSymbols])

  const runScan = useCallback(async (symbols) => {
    if (!symbols.length) return
    const now = new Date().toISOString()
    // Mark all as loading
    setScanResults(Object.fromEntries(symbols.map(s => [s, { loading: true, error: null, data: null }])))
    setScanTriggered(true)

    // One batch request instead of N individual calls
    let batchData = {}
    try {
      const res = await fetch(
        `/api/market-calendar?type=scanner-batch&symbols=${symbols.map(encodeURIComponent).join(',')}`
      )
      if (res.ok) batchData = await res.json()
      else throw new Error((await res.json()).message || 'Batch scan failed')
    } catch (err) {
      // If batch endpoint fails entirely, mark all as errored
      setScanResults(Object.fromEntries(symbols.map(s => [s, { loading: false, error: err.message, data: null }])))
      return
    }

    // Update each card from the batch response
    const newResults = {}
    const nextScanResults = {}
    for (const sym of symbols) {
      const entry = batchData[sym]
      if (entry?.data) {
        nextScanResults[sym] = { loading: false, error: null, data: entry.data }
        newResults[sym] = entry.data
      } else {
        nextScanResults[sym] = { loading: false, error: entry?.error ?? 'No data', data: null }
      }
    }
    setScanResults(nextScanResults)

    // Persist cache + history
    try { localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify({ scannedAt: now, results: newResults })) } catch {}
    setScanLastAt(now)
    setScanHistory(prev => {
      const updated = { ...prev }
      for (const [sym, data] of Object.entries(newResults)) {
        const entry = { scannedAt: now, score: data.score, price: data.price, rsi: data.rsi, hv: data.hv, pcRatio: data.pcRatio ?? null }
        updated[sym] = [...(updated[sym] ?? []), entry].slice(-30)
      }
      try { localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [])

  const sortedScanResults = useMemo(() => {
    return Object.entries(scanResults)
      .map(([sym, r]) => ({ symbol: sym, ...r }))
      .sort((a, b) => {
        const sa = a.data?.score ?? -1
        const sb = b.data?.score ?? -1
        return sb - sa
      })
  }, [scanResults])

  const sortedVolatilityData = useMemo(() => {
    const { col, dir } = volSort
    return [...volatilityData].sort((a, b) => {
      const av = a[col] ?? (col === 'symbol' ? '' : -Infinity)
      const bv = b[col] ?? (col === 'symbol' ? '' : -Infinity)
      if (col === 'symbol') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return dir === 'asc' ? av - bv : bv - av
    })
  }, [volatilityData, volSort])

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
            subValue={currentUnique > 0 ? `${currentUnique} unique` : null}
            icon={<IconCalendarEvent size={24} />}
            color={current.length > 0 ? 'orange' : 'blue'}
          />
          <SummaryCard
            label="Future Expirations"
            value={future.length}
            subValue={futureUnique > 0 ? `${futureUnique} unique` : null}
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
                  ? <Badge color="orange" variant="filled" size="sm">{current.length} ({currentUnique})</Badge>
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
                  ? <Badge color="blue" variant="light" size="sm">{future.length} ({futureUnique})</Badge>
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
                  ? <Badge color="gray" variant="light" size="sm">{past.length} ({pastUnique})</Badge>
                  : undefined
              }
            >
              Past
            </Tabs.Tab>
            <Tabs.Tab value="performance" leftSection={<IconCurrencyDollar size={16} />}>
              Performance
            </Tabs.Tab>
            <Tabs.Tab value="volatility" leftSection={<IconFlame size={16} />}>
              Volatility
            </Tabs.Tab>
            <Tabs.Tab value="scanner" leftSection={<IconRadar size={16} />}>
              Scanner
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

          {/* Performance */}
          <Tabs.Panel value="performance">
            {performanceData.length > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    {[
                      { col: 'symbol',       label: 'Ticker'        },
                      { col: 'count',        label: 'Trades'        },
                      { col: 'totalPremium', label: 'Total Premium' },
                      { col: 'avgYield',     label: 'Avg Yield %'   },
                      { col: 'bestYield',    label: 'Best Yield'    },
                      { col: 'worstYield',   label: 'Worst Yield'   },
                    ].map(({ col, label }) => (
                      <Table.Th key={col} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <UnstyledButton onClick={() => togglePerfSort(col)}>
                          <Group gap={4} wrap="nowrap">
                            <Text fw={600} size="sm">{label}</Text>
                            <PerfSortIcon col={col} />
                          </Group>
                        </UnstyledButton>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedPerformanceData.map(row => (
                    <Table.Tr key={row.symbol}>
                      <Table.Td><Text fw={700}>{row.symbol}</Text></Table.Td>
                      <Table.Td>{row.count}</Table.Td>
                      <Table.Td><Text fw={500} c="green">{formatCurrency(row.totalPremium)}</Text></Table.Td>
                      <Table.Td>
                        {row.avgYield != null
                          ? <Text fw={600} c={row.avgYield >= 3 ? 'green' : row.avgYield >= 1 ? 'yellow' : 'dimmed'}>{row.avgYield.toFixed(2)}%</Text>
                          : <Text c="dimmed">—</Text>}
                      </Table.Td>
                      <Table.Td>
                        {row.bestYield != null
                          ? <Text c="green">{row.bestYield.toFixed(2)}%</Text>
                          : <Text c="dimmed">—</Text>}
                      </Table.Td>
                      <Table.Td>
                        {row.worstYield != null
                          ? <Text c={row.worstYield >= 1 ? 'yellow' : 'dimmed'}>{row.worstYield.toFixed(2)}%</Text>
                          : <Text c="dimmed">—</Text>}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <EmptyState message="No covered call history yet" />
            )}
          </Tabs.Panel>

          {/* Volatility */}
          <Tabs.Panel value="volatility">
            <Stack gap="md">
              {/* Watchlist input */}
              <Card withBorder p="md">
                <Text size="sm" fw={600} mb="xs">Add ticker to watchlist</Text>
                <Group gap="sm" align="flex-end">
                  <TextInput
                    placeholder="e.g. NVDA, TSLA, SPY…"
                    value={watchlistInput}
                    onChange={e => setWatchlistInput(e.currentTarget.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') addToWatchlist(watchlistInput) }}
                    style={{ flex: 1 }}
                    size="sm"
                  />
                  <Button
                    size="sm"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => addToWatchlist(watchlistInput)}
                    disabled={!watchlistInput.trim()}
                  >
                    Add
                  </Button>
                </Group>
                {watchlist.length > 0 && (
                  <Group gap="xs" mt="sm">
                    {watchlist.map(sym => (
                      <Badge
                        key={sym}
                        variant="light"
                        color="violet"
                        rightSection={
                          <ActionIcon
                            size="xs"
                            variant="transparent"
                            color="violet"
                            onClick={() => removeFromWatchlist(sym)}
                          >
                            <IconX size={10} />
                          </ActionIcon>
                        }
                      >
                        {sym}
                      </Badge>
                    ))}
                  </Group>
                )}
              </Card>

              {quotesLoading ? (
                <Stack gap="sm">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}
                </Stack>
              ) : sortedVolatilityData.length > 0 ? (
                <>
                  <Group gap="xs">
                    <Badge color="green"  variant="light">≥ 60% elevated</Badge>
                    <Badge color="yellow" variant="light">40–59% moderate</Badge>
                    <Badge color="gray"   variant="light">&lt; 40% low</Badge>
                    <Text size="xs" c="dimmed" ml="auto">Higher HV = more premium available when selling options</Text>
                  </Group>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        {[
                          { col: 'symbol',      label: 'Ticker'        },
                          { col: 'hv',          label: '30d HV %'      },
                          { col: 'price',       label: 'Current Price' },
                          { col: 'openOptions', label: 'Open Options'  },
                          { col: 'totalTrades', label: 'Total Trades'  },
                        ].map(({ col, label }) => (
                          <Table.Th key={col} style={{ cursor: 'pointer', userSelect: 'none' }}>
                            <UnstyledButton onClick={() => toggleVolSort(col)}>
                              <Group gap={4} wrap="nowrap">
                                <Text fw={600} size="sm">{label}</Text>
                                <VolSortIcon col={col} />
                              </Group>
                            </UnstyledButton>
                          </Table.Th>
                        ))}
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sortedVolatilityData.map(row => {
                        const hvColor = row.hv >= 60 ? 'green' : row.hv >= 40 ? 'yellow' : 'dimmed'
                        return (
                          <Table.Tr key={row.symbol}>
                            <Table.Td>
                              <Group gap={6}>
                                <Text fw={700}>{row.symbol}</Text>
                                {row.watchlisted && !row.inPortfolio && (
                                  <Badge color="violet" variant="dot" size="xs">watchlist</Badge>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={6}>
                                <Text fw={700} c={hvColor}>{row.hv}%</Text>
                                {row.hv >= 60 && <IconFlame size={14} color="var(--mantine-color-green-5)" />}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              {row.price != null
                                ? <Text fw={500}>${row.price.toFixed(2)}</Text>
                                : <Text c="dimmed">—</Text>}
                            </Table.Td>
                            <Table.Td>
                              {row.openOptions > 0
                                ? <Badge color="blue" variant="light" size="sm">{row.openOptions} open</Badge>
                                : <Text c="dimmed" size="sm">—</Text>}
                            </Table.Td>
                            <Table.Td>
                              {row.inPortfolio
                                ? <Text c="dimmed">{row.totalTrades}</Text>
                                : <Text c="dimmed" size="xs">—</Text>}
                            </Table.Td>
                            <Table.Td>
                              {row.watchlisted && (
                                <Tooltip label="Remove from watchlist" withArrow>
                                  <ActionIcon
                                    size="xs"
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => removeFromWatchlist(row.symbol)}
                                  >
                                    <IconX size={12} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        )
                      })}
                    </Table.Tbody>
                  </Table>
                </>
              ) : (
                <EmptyState message="Add tickers to your watchlist or open some options positions" />
              )}
            </Stack>
          </Tabs.Panel>

          {/* Accumulation Scanner */}
          <Tabs.Panel value="scanner">
            <Stack gap="md">
              <Card withBorder p="md">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={700} size="sm" mb={2}>Accumulation Scanner</Text>
                    <Text size="xs" c="dimmed">
                      RSI, volume pattern, 52w discount, slow grind, P/C ratio, SEC filings.
                    </Text>
                    {scanLastAt && (
                      <Text size="xs" c="dimmed" mt={2}>
                        Last scanned {timeAgo(scanLastAt)}
                      </Text>
                    )}
                  </div>
                  <Button
                    leftSection={<IconRadar size={16} />}
                    onClick={() => runScan(scanSymbols)}
                    disabled={scanSymbols.length === 0}
                    loading={Object.values(scanResults).some(r => r.loading)}
                  >
                    Re-scan {scanSymbols.length > 0 ? `(${scanSymbols.length})` : ''}
                  </Button>
                </Group>

                {/* Ticker management */}
                <Divider my="sm" />
                <Group gap="xs" align="flex-end">
                  <TextInput
                    placeholder="Add ticker…"
                    size="xs"
                    value={scannerInput}
                    onChange={e => setScannerInput(e.currentTarget.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') addToScannerWatchlist(scannerInput) }}
                    style={{ width: 120 }}
                  />
                  <Button size="xs" variant="light" onClick={() => addToScannerWatchlist(scannerInput)} disabled={!scannerInput.trim()}>
                    Add
                  </Button>
                </Group>

                {/* Watchlist chips */}
                {scannerWatchlist.length > 0 && (
                  <Group gap={6} mt="xs">
                    {scannerWatchlist.map(sym => (
                      <Badge
                        key={sym}
                        variant="light"
                        color="blue"
                        size="sm"
                        rightSection={
                          <ActionIcon size={12} variant="transparent" color="blue" onClick={() => removeFromScannerWatchlist(sym)}>
                            <IconX size={10} />
                          </ActionIcon>
                        }
                      >
                        {sym}
                      </Badge>
                    ))}
                  </Group>
                )}

                {/* Auto-included from open positions */}
                {openPositionSymbols.length > 0 && (
                  <Group gap={6} mt={scannerWatchlist.length > 0 ? 4 : 'xs'} align="center">
                    <Text size="xs" c="dimmed">From positions:</Text>
                    {openPositionSymbols.map(sym => (
                      <Badge key={sym} variant="dot" color="gray" size="sm">{sym}</Badge>
                    ))}
                  </Group>
                )}

                {scanSymbols.length === 0 && (
                  <Alert color="yellow" mt="sm" icon={<IconAlertCircle size={16} />}>
                    Add tickers above or open some short options positions to scan.
                  </Alert>
                )}
              </Card>

              {!scanTriggered && scanSymbols.length > 0 && (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <IconRadar size={48} style={{ opacity: 0.3 }} />
                    <Text c="dimmed" size="sm">Hit Scan to analyse {scanSymbols.length} ticker{scanSymbols.length !== 1 ? 's' : ''}</Text>
                  </Stack>
                </Center>
              )}

              {sortedScanResults.length > 0 && (
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                  {sortedScanResults.map(({ symbol, loading: cardLoading, error, data }) => {
                    if (cardLoading) {
                      return (
                        <Card key={symbol} withBorder p="lg">
                          <Group justify="space-between" mb="sm">
                            <Text fw={700} size="lg">{symbol}</Text>
                            <Skeleton height={22} width={80} radius="xl" />
                          </Group>
                          <Skeleton height={8} mb="md" radius="xl" />
                          <Stack gap="xs">
                            {[...Array(4)].map((_, i) => <Skeleton key={i} height={16} radius="sm" />)}
                          </Stack>
                        </Card>
                      )
                    }
                    if (error) {
                      return (
                        <Card key={symbol} withBorder p="lg">
                          <Text fw={700} size="lg" mb="xs">{symbol}</Text>
                          <Text c="red" size="sm">{error}</Text>
                        </Card>
                      )
                    }
                    if (!data) return null
                    const { score, breakdown, price, pctFromHigh, rsi, hv,
                            high52w, consecutiveRed, insiderBuy, buyback } = data
                    const sl = scoreLabel(score)
                    const symHistory  = scanHistory[symbol] ?? []
                    // Delta vs the entry before the latest one
                    const prevEntry   = symHistory.length >= 2 ? symHistory[symHistory.length - 2] : null
                    const delta       = prevEntry != null ? score - prevEntry.score : null
                    // Trend: last 5 scan scores (oldest → newest)
                    const trendScores = symHistory.slice(-5).map(e => e.score)
                    return (
                      <Card key={symbol} withBorder p="lg"
                        style={score >= 75
                          ? { borderColor: 'var(--mantine-color-green-5)' }
                          : score >= 55
                          ? { borderColor: 'var(--mantine-color-teal-5)' }
                          : undefined}
                      >
                        <Group justify="space-between" mb="xs">
                          <Text fw={700} size="xl">{symbol}</Text>
                          <Group gap={6}>
                            {delta != null && (
                              <Badge
                                size="sm"
                                variant="light"
                                color={delta > 0 ? 'green' : delta < 0 ? 'red' : 'gray'}
                              >
                                {delta > 0 ? `+${delta}` : delta === 0 ? '=' : delta}
                              </Badge>
                            )}
                            <Badge color={sl.color} variant="light" size="lg">{score}</Badge>
                          </Group>
                        </Group>

                        <Group gap="xs" mb="sm">
                          <Badge color={sl.color} variant="filled" size="sm">
                            {sl.label}
                          </Badge>
                          {insiderBuy && <Badge color="grape" variant="light" size="sm">Insider Buy</Badge>}
                          {buyback    && <Badge color="violet" variant="light" size="sm">Buyback</Badge>}
                        </Group>

                        <Progress
                          value={score}
                          color={sl.color}
                          size="sm"
                          mb="sm"
                          radius="xl"
                        />

                        <SimpleGrid cols={3} mb="md" style={{ textAlign: 'center' }}>
                          <div>
                            <Text size="xs" c="dimmed">Price</Text>
                            <Text fw={600} size="sm">{price != null ? `$${price.toFixed(2)}` : '—'}</Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">RSI</Text>
                            <Text fw={600} size="sm"
                              c={rsi != null && rsi < 30 ? 'green' : rsi != null && rsi < 40 ? 'yellow' : 'dimmed'}>
                              {rsi ?? '—'}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">From 52w High</Text>
                            <Text fw={600} size="sm"
                              c={pctFromHigh != null && pctFromHigh < -40 ? 'green' : 'dimmed'}>
                              {pctFromHigh != null ? `${pctFromHigh}%` : '—'}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">52w High</Text>
                            <Text size="xs" c="dimmed">{high52w != null ? `$${high52w}` : '—'}</Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">HV</Text>
                            <Text size="xs" c={hv >= 50 ? 'green' : hv >= 35 ? 'yellow' : 'dimmed'}>{hv ?? '—'}%</Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">Red days</Text>
                            <Text size="xs" c={consecutiveRed >= 5 ? 'orange' : 'dimmed'}>{consecutiveRed}</Text>
                          </div>
                        </SimpleGrid>

                        <Divider mb="sm" />

                        <Stack gap={4}>
                          {breakdown.map((b, i) => (
                            <Group key={i} gap={6} wrap="nowrap">
                              <Text size="xs" c={
                                b.level === 'strong' ? 'green'
                                : b.level === 'good'   ? 'teal'
                                : b.level === 'mild'   ? 'yellow'
                                : 'dimmed'
                              }>
                                {b.level === 'none' || b.level === 'weak' ? '·' : '✓'}
                              </Text>
                              <Text size="xs" c={b.pts === 0 ? 'dimmed' : undefined} style={{ flex: 1 }}>
                                {b.label}
                              </Text>
                              {b.pts > 0 && (
                                <Badge size="xs" variant="light" color={
                                  b.level === 'strong' ? 'green'
                                  : b.level === 'good' ? 'teal'
                                  : 'yellow'
                                }>+{b.pts}</Badge>
                              )}
                            </Group>
                          ))}
                        </Stack>

                        {trendScores.length >= 2 && (
                          <>
                            <Divider mt="sm" mb="xs" />
                            <Group justify="space-between" align="center">
                              <Text size="xs" c="dimmed">Score trend</Text>
                              <Group gap={4}>
                                {trendScores.map((s, i) => {
                                  const isLatest = i === trendScores.length - 1
                                  const prev = i > 0 ? trendScores[i - 1] : null
                                  const up   = prev != null && s > prev
                                  const dn   = prev != null && s < prev
                                  return (
                                    <Text
                                      key={i}
                                      size="xs"
                                      fw={isLatest ? 700 : 400}
                                      c={isLatest ? sl.color : up ? 'green' : dn ? 'red' : 'dimmed'}
                                    >
                                      {i > 0 && <span style={{ opacity: 0.4, marginRight: 2 }}>›</span>}
                                      {s}
                                    </Text>
                                  )
                                })}
                              </Group>
                            </Group>
                          </>
                        )}

                        <Group justify="flex-end" mt="xs">
                          <Tooltip label="View on TradingView" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="xs"
                              component="a"
                              href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
                              target="_blank"
                            >
                              <IconTrendingUp size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Card>
                    )
                  })}
                </SimpleGrid>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  )
}
