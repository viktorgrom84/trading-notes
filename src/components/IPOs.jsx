import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Container, Title, Text, Stack, Card, Group, Badge, TextInput,
  Table, ScrollArea, Skeleton, Center, ThemeIcon, ActionIcon,
  Tabs, Tooltip, Paper
} from '@mantine/core'
import {
  IconSearch, IconRocket, IconArrowLeft, IconArrowRight, IconRefresh
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

const toMonthParam = (d) => d.toISOString().slice(0, 7) // YYYY-MM

const friendlyMonth = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  })
}

const formatDealSize = (raw) => {
  if (!raw) return '—'
  const num = parseFloat(raw.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return raw
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`
  return raw
}

const statusColor = (status) => {
  if (!status) return 'gray'
  const s = status.toLowerCase()
  if (s.includes('price') || s.includes('priced')) return 'green'
  if (s.includes('withdraw')) return 'red'
  if (s.includes('file') || s.includes('filed')) return 'blue'
  return 'violet'
}

function IPOTable({ rows, search, emptyMessage }) {
  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(
      r => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    )
  }, [rows, search])

  if (filtered.length === 0) {
    return (
      <Card withBorder>
        <Center py="xl">
          <Stack align="center" gap="md">
            <ThemeIcon size="xl" variant="light" color="gray">
              <IconRocket size={32} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="dimmed">{emptyMessage}</Text>
          </Stack>
        </Center>
      </Card>
    )
  }

  return (
    <Card withBorder p={0}>
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Symbol</Table.Th>
              <Table.Th>Company</Table.Th>
              <Table.Th>Exchange</Table.Th>
              <Table.Th>Price Range</Table.Th>
              <Table.Th>Shares</Table.Th>
              <Table.Th>Deal Size</Table.Th>
              <Table.Th>Date</Table.Th>
              {rows.some(r => r.status) && <Table.Th>Status</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((r, i) => (
              <Table.Tr key={`${r.symbol}-${i}`}>
                <Table.Td>
                  <Text fw={700} size="sm" c="blue">
                    {r.symbol || '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Tooltip label={r.name} disabled={r.name.length < 35} position="top" withArrow>
                    <Text size="sm" style={{ maxWidth: 220 }} truncate>
                      {r.name || '—'}
                    </Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.exchange || '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>{r.priceRange || '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.shares || '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDealSize(r.dealSize)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.expectedDate || '—'}</Text>
                </Table.Td>
                {rows.some(row => row.status) && (
                  <Table.Td>
                    {r.status ? (
                      <Badge color={statusColor(r.status)} variant="light" size="sm">
                        {r.status}
                      </Badge>
                    ) : '—'}
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Paper p="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
        <Text size="xs" c="dimmed">
          Showing {filtered.length} of {rows.length} IPOs · Source: NASDAQ
        </Text>
      </Paper>
    </Card>
  )
}

const VALID_IPO_TABS = ['upcoming', 'priced', 'withdrawn']

export default function IPOs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [month, setMonth] = useState(() => searchParams.get('month') ?? toMonthParam(new Date()))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [tab, setTab] = useState(() =>
    VALID_IPO_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'upcoming'
  )

  const updateSearch = (q) => {
    setSearch(q)
    setSearchParams(p => { const n = new URLSearchParams(p); q ? n.set('q', q) : n.delete('q'); return n }, { replace: true })
  }
  const updateTab = (t) => {
    setTab(t)
    setSearchParams(p => { const n = new URLSearchParams(p); t !== 'upcoming' ? n.set('tab', t) : n.delete('tab'); return n }, { replace: true })
  }
  const updateMonth = (m) => {
    setMonth(m)
    setSearchParams(p => { const n = new URLSearchParams(p); n.set('month', m); return n }, { replace: true })
  }

  const fetchIPOs = async (m) => {
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(`/api/market-calendar?type=ipos&date=${m}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load IPO data', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchIPOs(month) }, [month])

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    updateMonth(toMonthParam(d))
  }

  const tabData = {
    upcoming:  { label: 'Upcoming',  rows: data?.upcoming  || [], emptyMsg: 'No upcoming IPOs this month' },
    priced:    { label: 'Priced',    rows: data?.priced    || [], emptyMsg: 'No priced IPOs this month' },
    withdrawn: { label: 'Withdrawn', rows: data?.withdrawn || [], emptyMsg: 'No withdrawn IPOs this month' },
    filed:     { label: 'Filed',     rows: data?.filed     || [], emptyMsg: 'No filed IPOs this month' },
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1} mb="xs">IPO Calendar</Title>
            <Text c="dimmed" size="lg">Upcoming and recent IPOs from NASDAQ</Text>
          </div>
          <ActionIcon variant="subtle" size="lg" onClick={() => fetchIPOs(month)} loading={loading}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {/* Month Nav */}
        <Card withBorder p="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="xs">
              <ActionIcon variant="default" onClick={() => shiftMonth(-1)} size="lg">
                <IconArrowLeft size={16} />
              </ActionIcon>
              <Text fw={600} size="md" w={160} ta="center">
                {friendlyMonth(month)}
              </Text>
              <ActionIcon variant="default" onClick={() => shiftMonth(1)} size="lg">
                <IconArrowRight size={16} />
              </ActionIcon>
            </Group>

            {data && !loading && (
              <Group gap="xs">
                <Badge color="violet" variant="light">
                  Upcoming: {data.upcoming?.length ?? 0}
                </Badge>
                <Badge color="green" variant="light">
                  Priced: {data.priced?.length ?? 0}
                </Badge>
                <Badge color="red" variant="light">
                  Withdrawn: {data.withdrawn?.length ?? 0}
                </Badge>
                <Badge color="blue" variant="light">
                  Filed: {data.filed?.length ?? 0}
                </Badge>
              </Group>
            )}
          </Group>
        </Card>

        {/* Search */}
        <TextInput
          placeholder="Search symbol or company..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
          w={280}
        />

        {/* Tabs + Table */}
        {loading ? (
          <Stack gap="xs">
            {[...Array(8)].map((_, i) => <Skeleton key={i} height={52} />)}
          </Stack>
        ) : (
          <Tabs value={tab} onChange={updateTab}>
            <Tabs.List mb="md">
              {Object.entries(tabData).map(([key, { label, rows }]) => (
                <Tabs.Tab
                  key={key}
                  value={key}
                  rightSection={
                    <Badge size="xs" variant="filled" color={key === 'upcoming' ? 'violet' : key === 'priced' ? 'green' : key === 'withdrawn' ? 'red' : 'blue'} circle>
                      {rows.length}
                    </Badge>
                  }
                >
                  {label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {Object.entries(tabData).map(([key, { rows, emptyMsg }]) => (
              <Tabs.Panel key={key} value={key}>
                <IPOTable rows={rows} search={search} emptyMessage={emptyMsg} />
              </Tabs.Panel>
            ))}
          </Tabs>
        )}
      </Stack>
    </Container>
  )
}
