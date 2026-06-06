import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Container, Title, Text, Stack, Card, Group, Badge, TextInput,
  Skeleton, Center, ThemeIcon, ActionIcon, Button, Paper,
  Tooltip, SegmentedControl
} from '@mantine/core'
import {
  IconSearch, IconCalendarEvent, IconArrowLeft, IconArrowRight,
  IconRefresh, IconAlertTriangle, IconInfoCircle
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

const toInputDate = (date) => date.toLocaleDateString('en-CA')

const friendlyDate = (isoDate) =>
  new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })

// Keywords that flag an event as high-importance
const HIGH_IMPACT_KEYWORDS = [
  'federal reserve', 'fed ', 'fomc', 'interest rate', 'powell',
  'cpi', 'consumer price', 'inflation',
  'nonfarm', 'non-farm', 'payroll', 'unemployment', 'jobs report',
  'gdp', 'gross domestic',
  'pce', 'personal consumption',
  'retail sales',
]

const isHighImpact = (event) => {
  const text = (event.eventName + ' ' + event.description).toLowerCase()
  return HIGH_IMPACT_KEYWORDS.some(k => text.includes(k))
}

const isUS = (event) =>
  event.country.toLowerCase() === 'united states' || event.country.toLowerCase() === 'us'

const formatGmt = (gmt) => {
  if (!gmt || gmt === 'All Day') return 'All Day'
  // gmt is like "12:30" — convert to ET (UTC-4 EDT / UTC-5 EST)
  try {
    const [h, m] = gmt.split(':').map(Number)
    // Approximate: use UTC-4 (EDT) as default for US market hours
    let etH = h - 4
    if (etH < 0) etH += 24
    const period = etH >= 12 ? 'PM' : 'AM'
    const display = etH % 12 === 0 ? 12 : etH % 12
    return `${display}:${String(m).padStart(2, '0')} ${period} ET`
  } catch {
    return gmt + ' GMT'
  }
}

const impactColor = (event) => {
  if (isHighImpact(event)) return 'red'
  if (isUS(event)) return 'blue'
  return 'gray'
}


export default function EconomicEvents() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [date, setDate] = useState(() => searchParams.get('date') ?? toInputDate(new Date()))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [filter, setFilter] = useState(() =>
    ['all', 'us', 'high'].includes(searchParams.get('filter')) ? searchParams.get('filter') : 'all'
  )

  const updateDate = (d) => {
    setDate(d)
    setSearchParams(p => { const n = new URLSearchParams(p); n.set('date', d); return n }, { replace: true })
  }
  const updateSearch = (q) => {
    setSearch(q)
    setSearchParams(p => { const n = new URLSearchParams(p); q ? n.set('q', q) : n.delete('q'); return n }, { replace: true })
  }
  const updateFilter = (f) => {
    setFilter(f)
    setSearchParams(p => { const n = new URLSearchParams(p); f !== 'all' ? n.set('filter', f) : n.delete('filter'); return n }, { replace: true })
  }

  const fetchEvents = async (d) => {
    setLoading(true)
    setEvents([])
    try {
      const res = await fetch(`/api/economic-events?date=${d}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEvents(data.events || [])
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load economic events', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents(date) }, [date])

  const shiftDay = (delta) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    updateDate(toInputDate(d))
  }

  const filtered = useMemo(() => {
    return events.filter(e => {
      const matchSearch = !search ||
        e.eventName.toLowerCase().includes(search.toLowerCase()) ||
        e.country.toLowerCase().includes(search.toLowerCase())
      const matchFilter =
        filter === 'all' ||
        (filter === 'us' && isUS(e)) ||
        (filter === 'high' && isHighImpact(e))
      return matchSearch && matchFilter
    })
  }, [events, search, filter])

  const counts = useMemo(() => ({
    high: events.filter(isHighImpact).length,
    us: events.filter(e => isUS(e) && !isHighImpact(e)).length,
  }), [events])

  // Group by time for display
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const key = e.gmt === 'All Day' ? 'All Day' : formatGmt(e.gmt)
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    // Sort by time: All Day last, others sorted
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'All Day') return 1
      if (b === 'All Day') return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1} mb="xs">Economic Events</Title>
            <Text c="dimmed" size="lg">Fed meetings, CPI, jobs reports and more</Text>
          </div>
          <ActionIcon variant="subtle" size="lg" onClick={() => fetchEvents(date)} loading={loading}>
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
                onChange={(e) => updateDate(e.target.value)}
                w={160}
              />
              <ActionIcon variant="default" onClick={() => shiftDay(1)} size="lg">
                <IconArrowRight size={16} />
              </ActionIcon>
              <Button variant="subtle" size="sm" onClick={() => updateDate(toInputDate(new Date()))}>
                Today
              </Button>
            </Group>

            {!loading && events.length > 0 && (
              <Group gap="xs">
                {counts.high > 0 && (
                  <Badge color="red" leftSection={<IconAlertTriangle size={12} />} variant="light">
                    High Impact: {counts.high}
                  </Badge>
                )}
                <Badge color="blue" variant="light">
                  US Events: {events.filter(isUS).length}
                </Badge>
                <Badge color="gray" variant="light">
                  Total: {events.length}
                </Badge>
              </Group>
            )}
          </Group>
        </Card>

        {/* Filters */}
        <Card withBorder p="md">
          <Group gap="md" wrap="wrap">
            <TextInput
              placeholder="Search event or country..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
              w={260}
            />
            <SegmentedControl
              value={filter}
              onChange={updateFilter}
              data={[
                { label: 'All', value: 'all' },
                { label: '🇺🇸 US Only', value: 'us' },
                { label: '🔴 High Impact', value: 'high' },
              ]}
              size="sm"
            />
          </Group>
        </Card>

        {/* Events */}
        {loading ? (
          <Stack gap="xs">
            {[...Array(6)].map((_, i) => <Skeleton key={i} height={64} />)}
          </Stack>
        ) : filtered.length === 0 ? (
          <Card withBorder>
            <Center py="xl">
              <Stack align="center" gap="md">
                <ThemeIcon size="xl" variant="light" color="gray">
                  <IconCalendarEvent size={32} />
                </ThemeIcon>
                <div style={{ textAlign: 'center' }}>
                  <Text size="lg" fw={500} mb="xs">
                    {events.length === 0
                      ? `No events on ${friendlyDate(date)}`
                      : 'No events match your filter'}
                  </Text>
                  <Text c="dimmed" size="sm">Try a different date or clear the filter</Text>
                </div>
              </Stack>
            </Center>
          </Card>
        ) : (
          <Stack gap="md">
            {grouped.map(([timeSlot, slotEvents]) => (
              <div key={timeSlot}>
                {/* Time slot header */}
                <Group gap="sm" mb="xs">
                  <Text fw={700} size="sm" c="dimmed" style={{ minWidth: 110 }}>
                    {timeSlot}
                  </Text>
                  <div style={{ flex: 1, height: 1, background: 'var(--mantine-color-gray-2)' }} />
                </Group>

                <Stack gap="xs">
                  {slotEvents.map((e, i) => {
                    const high = isHighImpact(e)
                    const usEvent = isUS(e)
                    const hasNumbers = e.actual || e.consensus || e.previous

                    return (
                      <Card
                        key={i}
                        withBorder
                        p="md"
                        style={{
                          borderLeft: `3px solid var(--mantine-color-${impactColor(e)}-${high ? '6' : usEvent ? '4' : '3'})`,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                          <Group gap="sm" align="flex-start">
                            <div>
                              <Group gap="xs" mb={4}>
                                <Text fw={600} size="sm">{e.eventName}</Text>
                                {high && (
                                  <Badge color="red" size="xs" variant="filled">
                                    HIGH IMPACT
                                  </Badge>
                                )}
                                <Badge color="gray" size="xs" variant="outline">
                                  {e.country}
                                </Badge>
                              </Group>
                              {e.description && (
                                <Tooltip
                                  label={e.description}
                                  multiline
                                  w={380}
                                  position="bottom-start"
                                  withArrow
                                >
                                  <ActionIcon size="xs" variant="subtle" color="gray">
                                    <IconInfoCircle size={13} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </div>
                          </Group>

                          {hasNumbers && (
                            <Group gap="xl">
                              {e.actual && e.actual !== ' ' && (
                                <div style={{ textAlign: 'center' }}>
                                  <Text size="xs" c="dimmed">Actual</Text>
                                  <Text fw={700} size="sm" c={
                                    e.consensus && e.actual !== ' '
                                      ? parseFloat(e.actual) > parseFloat(e.consensus) ? 'green' : 'red'
                                      : undefined
                                  }>
                                    {e.actual}
                                  </Text>
                                </div>
                              )}
                              {e.consensus && e.consensus !== ' ' && (
                                <div style={{ textAlign: 'center' }}>
                                  <Text size="xs" c="dimmed">Forecast</Text>
                                  <Text fw={500} size="sm">{e.consensus}</Text>
                                </div>
                              )}
                              {e.previous && e.previous !== ' ' && (
                                <div style={{ textAlign: 'center' }}>
                                  <Text size="xs" c="dimmed">Previous</Text>
                                  <Text size="sm" c="dimmed">{e.previous}</Text>
                                </div>
                              )}
                            </Group>
                          )}
                        </Group>
                      </Card>
                    )
                  })}
                </Stack>
              </div>
            ))}

            <Paper p="sm" withBorder>
              <Text size="xs" c="dimmed">
                Showing {filtered.length} of {events.length} events · {friendlyDate(date)} · Source: NASDAQ · Times shown in ET (UTC-4)
              </Text>
            </Paper>
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
