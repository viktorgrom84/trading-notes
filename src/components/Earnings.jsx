import { useState, useEffect, useMemo } from 'react'
import {
  Container, Title, Text, Stack, Card, Group, Badge, TextInput,
  Table, ScrollArea, Skeleton, Center, ThemeIcon, ActionIcon,
  SegmentedControl, Tooltip, Button, Paper
} from '@mantine/core'
import {
  IconSearch, IconChartBar, IconArrowLeft, IconArrowRight,
  IconSunrise, IconMoon, IconClock, IconRefresh
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

const toInputDate = (date) => date.toLocaleDateString('en-CA') // YYYY-MM-DD

const friendlyDate = (isoDate) =>
  new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })

const timeLabel = (timeStr) => {
  if (!timeStr) return { label: 'TBD', color: 'gray' }
  const t = timeStr.toLowerCase()
  if (t.includes('pre')) return { label: 'Pre-Market', color: 'blue' }
  if (t.includes('after') || t.includes('post')) return { label: 'After Hours', color: 'orange' }
  return { label: 'During Market', color: 'green' }
}

const formatMarketCap = (mcStr) => {
  if (!mcStr) return '-'
  const num = parseFloat(mcStr.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return mcStr
  if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`
  return mcStr
}

export default function Earnings() {
  const [date, setDate] = useState(toInputDate(new Date()))
  const [earnings, setEarnings] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [timeFilter, setTimeFilter] = useState('all')

  const fetchEarnings = async (d) => {
    setLoading(true)
    setEarnings([])
    try {
      const res = await fetch(`/api/market-calendar?date=${d}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEarnings(data.earnings || [])
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load earnings data', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEarnings(date) }, [date])

  const shiftDay = (delta) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(toInputDate(d))
  }

  const filtered = useMemo(() => {
    return earnings.filter(e => {
      const matchSearch = !search ||
        e.symbol.toLowerCase().includes(search.toLowerCase()) ||
        e.name.toLowerCase().includes(search.toLowerCase())
      const matchTime = timeFilter === 'all' ||
        (timeFilter === 'pre' && e.time.toLowerCase().includes('pre')) ||
        (timeFilter === 'after' && (e.time.toLowerCase().includes('after') || e.time.toLowerCase().includes('post')))
      return matchSearch && matchTime
    })
  }, [earnings, search, timeFilter])

  const counts = useMemo(() => ({
    pre: earnings.filter(e => e.time.toLowerCase().includes('pre')).length,
    after: earnings.filter(e => e.time.toLowerCase().includes('after') || e.time.toLowerCase().includes('post')).length,
    tbd: earnings.filter(e => !e.time || (!e.time.toLowerCase().includes('pre') && !e.time.toLowerCase().includes('after') && !e.time.toLowerCase().includes('post'))).length,
  }), [earnings])

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1} mb="xs">Earnings Calendar</Title>
            <Text c="dimmed" size="lg">Upcoming earnings reports from NASDAQ</Text>
          </div>
          <ActionIcon variant="subtle" size="lg" onClick={() => fetchEarnings(date)} loading={loading}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {/* Date Nav */}
        <Card withBorder p="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="xs">
              <ActionIcon variant="default" onClick={() => shiftDay(-1)} size="lg">
                <IconArrowLeft size={16} />
              </ActionIcon>
              <TextInput
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                w={160}
              />
              <ActionIcon variant="default" onClick={() => shiftDay(1)} size="lg">
                <IconArrowRight size={16} />
              </ActionIcon>
              <Button variant="subtle" size="sm" onClick={() => setDate(toInputDate(new Date()))}>
                Today
              </Button>
            </Group>

            {!loading && earnings.length > 0 && (
              <Group gap="xs">
                <Badge color="blue" leftSection={<IconSunrise size={12} />} variant="light">
                  Pre-Market: {counts.pre}
                </Badge>
                <Badge color="orange" leftSection={<IconMoon size={12} />} variant="light">
                  After Hours: {counts.after}
                </Badge>
                {counts.tbd > 0 && (
                  <Badge color="gray" leftSection={<IconClock size={12} />} variant="light">
                    TBD: {counts.tbd}
                  </Badge>
                )}
                <Badge color="violet" variant="light">
                  Total: {earnings.length}
                </Badge>
              </Group>
            )}
          </Group>
        </Card>

        {/* Filters */}
        <Card withBorder p="md">
          <Group gap="md" wrap="wrap">
            <TextInput
              placeholder="Search symbol or company..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              w={260}
            />
            <SegmentedControl
              value={timeFilter}
              onChange={setTimeFilter}
              data={[
                { label: 'All', value: 'all' },
                { label: 'Pre-Market', value: 'pre' },
                { label: 'After Hours', value: 'after' },
              ]}
              size="sm"
            />
          </Group>
        </Card>

        {/* Table */}
        {loading ? (
          <Stack gap="xs">
            {[...Array(8)].map((_, i) => <Skeleton key={i} height={52} />)}
          </Stack>
        ) : filtered.length === 0 ? (
          <Card withBorder>
            <Center py="xl">
              <Stack align="center" gap="md">
                <ThemeIcon size="xl" variant="light" color="gray">
                  <IconChartBar size={32} />
                </ThemeIcon>
                <div style={{ textAlign: 'center' }}>
                  <Text size="lg" fw={500} mb="xs">
                    {earnings.length === 0 ? `No earnings on ${friendlyDate(date)}` : 'No results match your filter'}
                  </Text>
                  <Text c="dimmed" size="sm">Try a different date or clear the search</Text>
                </div>
              </Stack>
            </Center>
          </Card>
        ) : (
          <Card withBorder p={0}>
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Symbol</Table.Th>
                    <Table.Th>Company</Table.Th>
                    <Table.Th>When</Table.Th>
                    <Table.Th>EPS Forecast</Table.Th>
                    <Table.Th>Last Year EPS</Table.Th>
                    <Table.Th>Market Cap</Table.Th>
                    <Table.Th>Quarter</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filtered.map((e, i) => {
                    const tl = timeLabel(e.time)
                    return (
                      <Table.Tr key={`${e.symbol}-${i}`}>
                        <Table.Td>
                          <Text fw={700} size="sm" c="blue">{e.symbol}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label={e.name} disabled={e.name.length < 35} position="top" withArrow>
                            <Text size="sm" style={{ maxWidth: 220 }} truncate>
                              {e.name}
                            </Text>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={tl.color} variant="light" size="sm">
                            {tl.label}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {e.epsForecast && e.epsForecast !== '-' ? e.epsForecast : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Text size="sm">{e.lastYearEps || '—'}</Text>
                            {e.lastYearDate && (
                              <Text size="xs" c="dimmed">({e.lastYearDate})</Text>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatMarketCap(e.marketCap)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{e.fiscalQuarterEnding || '—'}</Text>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            <Paper p="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              <Text size="xs" c="dimmed">
                Showing {filtered.length} of {earnings.length} companies · {friendlyDate(date)} · Source: NASDAQ
              </Text>
            </Paper>
          </Card>
        )}
      </Stack>
    </Container>
  )
}
