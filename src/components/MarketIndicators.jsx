import { useState, useEffect, useMemo } from 'react'
import {
  Container, Title, Text, Stack, Card, Group, Badge, Skeleton,
  Center, ThemeIcon, ActionIcon, SimpleGrid, RingProgress, Paper, SegmentedControl, Button
} from '@mantine/core'
import { LineChart } from '@mantine/charts'
import { IconRefresh, IconChartLine, IconAlertTriangle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

const ZONES = [
  { max: 10,       label: 'Extremely Undervalued', color: 'teal',   hex: '#12b886', description: 'Rare historic buying opportunity' },
  { max: 15,       label: 'Undervalued',           color: 'green',  hex: '#40c057', description: 'Below long-term average — historically strong returns ahead' },
  { max: 20,       label: 'Fair Value',            color: 'blue',   hex: '#228be6', description: 'Near long-term average (~17) — neutral outlook' },
  { max: 25,       label: 'Slightly Overvalued',   color: 'yellow', hex: '#fab005', description: 'Above average — expect moderate returns' },
  { max: 30,       label: 'Overvalued',            color: 'orange', hex: '#fd7e14', description: 'Well above average — caution warranted' },
  { max: Infinity, label: 'Extremely Overvalued',  color: 'red',    hex: '#fa5252', description: 'Near bubble territory — historically poor 10-year returns' },
]

const RANGES = [
  { label: '1Y',  months: 12 },
  { label: '5Y',  months: 60 },
  { label: '10Y', months: 120 },
  { label: '20Y', months: 240 },
  { label: '50Y', months: 600 },
  { label: 'All', months: Infinity },
]

function getZone(value) {
  return ZONES.find(z => value < z.max) || ZONES[ZONES.length - 1]
}

function impliedReturn(cape) {
  return cape > 0 ? ((1 / cape) * 100).toFixed(1) : '—'
}

export default function MarketIndicators() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [range, setRange]   = useState('10Y')

  const fetchData = async () => {
    setLoading(true)
    setData(null)
    try {
      const res = await fetch('/api/market-indicators')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load market indicators', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const current = data?.current
  const zone    = current ? getZone(current.value) : null
  const avg     = data?.historicalAverage ?? 17.0
  const ringPct = current ? Math.min((current.value / 45) * 100, 100) : 0

  // Filter history by selected range
  const chartData = useMemo(() => {
    if (!data?.history) return []
    const months = RANGES.find(r => r.label === range)?.months ?? Infinity
    const sliced = months === Infinity ? data.history : data.history.slice(-months)
    return sliced.map(p => ({ date: p.date, CAPE: p.value, Avg: avg }))
  }, [data, range, avg])

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1} mb="xs">Market Indicators</Title>
            <Text c="dimmed" size="lg">Shiller P/E (CAPE) — Cyclically Adjusted Price-to-Earnings Ratio</Text>
          </div>
          <ActionIcon variant="subtle" size="lg" onClick={fetchData} loading={loading}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {loading ? (
          <Stack gap="md">
            <Skeleton height={180} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}><Skeleton height={120} /><Skeleton height={120} /><Skeleton height={120} /></SimpleGrid>
            <Skeleton height={380} />
          </Stack>
        ) : !data ? null : (
          <>
            {/* Current value hero */}
            <Card withBorder radius="md" p="xl" style={{ borderColor: zone?.hex, borderWidth: 2 }}>
              <Group justify="space-between" align="center" wrap="wrap" gap="xl">
                <Group gap="xl" align="center">
                  <RingProgress
                    size={110} thickness={10} roundCaps
                    sections={[{ value: ringPct, color: zone?.hex }]}
                    label={<Text ta="center" fw={800} size="xl" c={zone?.color}>{current?.value?.toFixed(1)}</Text>}
                  />
                  <div>
                    <Group gap="xs" mb={4}>
                      <Text fw={800} size="28px">{current?.value?.toFixed(2)}</Text>
                      <Badge color={zone?.color} size="lg" variant="filled">{zone?.label}</Badge>
                    </Group>
                    <Text c="dimmed" size="sm" mb={4}>
                      As of {current?.date ? new Date(current.date + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                    </Text>
                    <Text size="sm" c={zone?.color} fw={500}>{zone?.description}</Text>
                  </div>
                </Group>
                <Stack gap="xs" align="flex-end">
                  <Paper withBorder p="sm" radius="md" style={{ minWidth: 160, textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">Historical Avg</Text>
                    <Text fw={700} size="lg">~{avg}</Text>
                  </Paper>
                  <Paper withBorder p="sm" radius="md" style={{ minWidth: 160, textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">vs. Average</Text>
                    <Text fw={700} size="lg" c={current?.value > avg ? 'red' : 'green'}>
                      {current ? `${((current.value / avg - 1) * 100).toFixed(0)}% ${current.value > avg ? 'above' : 'below'}` : '—'}
                    </Text>
                  </Paper>
                  <Paper withBorder p="sm" radius="md" style={{ minWidth: 160, textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">Implied 10-yr Real Return</Text>
                    <Text fw={700} size="lg" c="blue">~{current ? impliedReturn(current.value) : '—'}% / yr</Text>
                  </Paper>
                </Stack>
              </Group>
            </Card>

            {/* Interactive chart */}
            <Card withBorder p="xl" radius="md">
              <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
                <div>
                  <Title order={3}>CAPE History</Title>
                  <Text size="sm" c="dimmed">Monthly data · Source: multpl.com / Robert Shiller</Text>
                </div>
                <Group gap="xs">
                  {RANGES.map(r => (
                    <Button
                      key={r.label}
                      size="xs"
                      variant={range === r.label ? 'filled' : 'default'}
                      color={range === r.label ? 'blue' : undefined}
                      onClick={() => setRange(r.label)}
                    >
                      {r.label}
                    </Button>
                  ))}
                </Group>
              </Group>
              <LineChart
                h={340}
                data={chartData}
                dataKey="date"
                series={[
                  { name: 'CAPE',  color: zone?.hex ?? '#228be6' },
                  { name: 'Avg',   color: '#adb5bd', strokeDasharray: '6 4' },
                ]}
                curveType="monotone"
                tickLine="none"
                gridAxis="y"
                withDots={false}
                withTooltip
                tooltipAnimationDuration={100}
                yAxisProps={{ domain: ['auto', 'auto'] }}
                xAxisProps={{
                  tickFormatter: (v) => {
                    if (!v) return ''
                    const [y, m] = v.split('-')
                    // Show fewer ticks to avoid crowding
                    return m === '01' ? y : ''
                  },
                }}
                referenceLines={[
                  { y: avg, label: `Avg ~${avg}`, color: 'gray' },
                ]}
              />
            </Card>

            {/* Valuation zones */}
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
              {ZONES.map(z => (
                <Card key={z.label} withBorder p="sm" radius="md"
                  style={{ borderColor: zone?.label === z.label ? z.hex : undefined, borderWidth: zone?.label === z.label ? 2 : 1 }}
                >
                  <Group gap="xs" mb={4}>
                    <ThemeIcon size="xs" color={z.color} variant="filled" radius="xl"><span /></ThemeIcon>
                    <Text size="xs" fw={600}>{z.label}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">{z.description}</Text>
                </Card>
              ))}
            </SimpleGrid>

            {/* Explainer */}
            <Card withBorder p="xl" radius="md">
              <Group gap="sm" mb="md">
                <ThemeIcon size="lg" variant="light" color="violet"><IconInfoCircle size={20} /></ThemeIcon>
                <Title order={3}>What is the Shiller P/E (CAPE)?</Title>
              </Group>
              <Stack gap="sm">
                <Text size="sm">
                  The <strong>Cyclically Adjusted Price-to-Earnings Ratio</strong>, developed by Nobel laureate Robert Shiller, divides
                  the current S&P 500 price by the <strong>10-year inflation-adjusted average earnings</strong>. This smooths out
                  short-term earnings swings caused by recessions and booms.
                </Text>
                <Group gap="xl" wrap="wrap">
                  <Group gap="xs">
                    <ThemeIcon size="sm" color="green" variant="light"><IconCircleCheck size={14} /></ThemeIcon>
                    <Text size="sm"><strong>Low CAPE (&lt;15)</strong> — cheap market, strong future returns historically</Text>
                  </Group>
                  <Group gap="xs">
                    <ThemeIcon size="sm" color="orange" variant="light"><IconAlertTriangle size={14} /></ThemeIcon>
                    <Text size="sm"><strong>High CAPE (&gt;30)</strong> — expensive market, lower expected 10-yr returns</Text>
                  </Group>
                </Group>
                <Text size="xs" c="dimmed">
                  CAPE is a long-term valuation tool, not a short-term timing signal. Markets can remain elevated for years.
                </Text>
              </Stack>
            </Card>
          </>
        )}
      </Stack>
    </Container>
  )
}

const ZONES = [
  { max: 10,  label: 'Extremely Undervalued', color: 'teal',   hex: '#12b886', description: 'Rare historic buying opportunity' },
  { max: 15,  label: 'Undervalued',           color: 'green',  hex: '#40c057', description: 'Below long-term average — historically strong returns ahead' },
  { max: 20,  label: 'Fair Value',            color: 'blue',   hex: '#228be6', description: 'Near long-term average (~17) — neutral outlook' },
  { max: 25,  label: 'Slightly Overvalued',   color: 'yellow', hex: '#fab005', description: 'Above average — expect moderate returns' },
  { max: 30,  label: 'Overvalued',            color: 'orange', hex: '#fd7e14', description: 'Well above average — caution warranted' },
  { max: Infinity, label: 'Extremely Overvalued', color: 'red', hex: '#fa5252', description: 'Near bubble territory — historically poor 10-year returns' },
]

function getZone(value) {
  return ZONES.find(z => value < z.max) || ZONES[ZONES.length - 1]
}

function impliedReturn(cape) {
  // Simplified: 1/CAPE gives earnings yield; roughly correlates to 10-yr real return
  return cape > 0 ? ((1 / cape) * 100).toFixed(1) : '—'
}

export default function MarketIndicators() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setData(null)
    try {
      const res = await fetch('/api/market-indicators')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load market indicators', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const current = data?.current
  const zone = current ? getZone(current.value) : null
  const avg = data?.historicalAverage ?? 17.0
  // Clamp ring to 0-100 where 40 = full ring (anything above 40 is deep red)
  const ringPct = current ? Math.min((current.value / 40) * 100, 100) : 0

  const chartData = (data?.history ?? []).map(p => ({
    date: p.date,
    CAPE: p.value,
    Average: avg,
  }))

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1} mb="xs">Market Indicators</Title>
            <Text c="dimmed" size="lg">Shiller P/E (CAPE) — Cyclically Adjusted Price-to-Earnings Ratio</Text>
          </div>
          <ActionIcon variant="subtle" size="lg" onClick={fetchData} loading={loading}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {loading ? (
          <Stack gap="md">
            <Skeleton height={180} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}><Skeleton height={120} /><Skeleton height={120} /><Skeleton height={120} /></SimpleGrid>
            <Skeleton height={340} />
          </Stack>
        ) : !data ? null : (
          <>
            {/* Current value hero card */}
            <Card withBorder radius="md" p="xl" style={{ borderColor: zone?.hex, borderWidth: 2 }}>
              <Group justify="space-between" align="center" wrap="wrap" gap="xl">
                <Group gap="xl" align="center">
                  <RingProgress
                    size={110}
                    thickness={10}
                    roundCaps
                    sections={[{ value: ringPct, color: zone?.hex }]}
                    label={
                      <Text ta="center" fw={800} size="xl" c={zone?.color}>
                        {current?.value?.toFixed(1) ?? '—'}
                      </Text>
                    }
                  />
                  <div>
                    <Group gap="xs" mb={4}>
                      <Text fw={800} size="28px">{current?.value?.toFixed(2)}</Text>
                      <Badge color={zone?.color} size="lg" variant="filled">{zone?.label}</Badge>
                    </Group>
                    <Text c="dimmed" size="sm" mb={4}>
                      As of {current?.date ? new Date(current.date + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                    </Text>
                    <Text size="sm" c={zone?.color} fw={500}>{zone?.description}</Text>
                  </div>
                </Group>

                <Stack gap="xs" align="flex-end">
                  <Paper withBorder p="sm" radius="md" style={{ minWidth: 160, textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">Historical Avg</Text>
                    <Text fw={700} size="lg">~{avg}</Text>
                  </Paper>
                  <Paper withBorder p="sm" radius="md" style={{ minWidth: 160, textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">vs. Average</Text>
                    <Text fw={700} size="lg" c={current?.value > avg ? 'red' : 'green'}>
                      {current ? `${((current.value / avg - 1) * 100).toFixed(0)}% ${current.value > avg ? 'above' : 'below'}` : '—'}
                    </Text>
                  </Paper>
                  <Paper withBorder p="sm" radius="md" style={{ minWidth: 160, textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">Implied 10-yr Real Return</Text>
                    <Text fw={700} size="lg" c="blue">~{current ? impliedReturn(current.value) : '—'}% / yr</Text>
                  </Paper>
                </Stack>
              </Group>
            </Card>

            {/* Valuation zones legend */}
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
              {ZONES.map(z => (
                <Card key={z.label} withBorder p="sm" radius="md"
                  style={{ borderColor: zone?.label === z.label ? z.hex : undefined, borderWidth: zone?.label === z.label ? 2 : 1 }}
                >
                  <Group gap="xs" mb={4}>
                    <ThemeIcon size="xs" color={z.color} variant="filled" radius="xl"><span /></ThemeIcon>
                    <Text size="xs" fw={600}>{z.label}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">{z.description}</Text>
                </Card>
              ))}
            </SimpleGrid>

            {/* 10-year historical chart */}
            {chartData.length > 0 && (
              <Card withBorder p="xl" radius="md">
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={3}>10-Year CAPE History</Title>
                    <Text size="sm" c="dimmed">Monthly data · Source: multpl.com / Robert Shiller</Text>
                  </div>
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconChartLine size={20} />
                  </ThemeIcon>
                </Group>
                <LineChart
                  h={300}
                  data={chartData}
                  dataKey="date"
                  series={[
                    { name: 'CAPE', color: zone?.hex ?? 'blue' },
                    { name: 'Average', color: 'gray.5' },
                  ]}
                  curveType="monotone"
                  tickLine="none"
                  gridAxis="y"
                  yAxisProps={{ domain: ['auto', 'auto'] }}
                  tooltipProps={{ formatter: (v) => v?.toFixed(2) }}
                />
              </Card>
            )}

            {/* What is CAPE? */}
            <Card withBorder p="xl" radius="md">
              <Group gap="sm" mb="md">
                <ThemeIcon size="lg" variant="light" color="violet">
                  <IconInfoCircle size={20} />
                </ThemeIcon>
                <Title order={3}>What is the Shiller P/E (CAPE)?</Title>
              </Group>
              <Stack gap="sm">
                <Text size="sm">
                  The <strong>Cyclically Adjusted Price-to-Earnings Ratio</strong>, developed by Nobel laureate Robert Shiller, divides
                  the current S&P 500 price by the <strong>10-year inflation-adjusted average earnings</strong>. This smooths out
                  short-term earnings swings caused by recessions and booms.
                </Text>
                <Group gap="xl" wrap="wrap">
                  <Group gap="xs">
                    <ThemeIcon size="sm" color="green" variant="light"><IconCircleCheck size={14} /></ThemeIcon>
                    <Text size="sm"><strong>Low CAPE (&lt;15)</strong> — cheap market, strong future returns historically</Text>
                  </Group>
                  <Group gap="xs">
                    <ThemeIcon size="sm" color="orange" variant="light"><IconAlertTriangle size={14} /></ThemeIcon>
                    <Text size="sm"><strong>High CAPE (&gt;30)</strong> — expensive market, lower expected 10-yr returns</Text>
                  </Group>
                </Group>
                <Text size="xs" c="dimmed">
                  Note: CAPE is a long-term valuation tool, not a short-term timing signal. Markets can remain elevated for years.
                  The implied return estimate uses the earnings yield (1/CAPE) as a rough real return proxy.
                </Text>
              </Stack>
            </Card>
          </>
        )}
      </Stack>
    </Container>
  )
}
