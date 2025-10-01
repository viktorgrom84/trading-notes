import { useState, useEffect } from 'react'
import { 
  Card, 
  Title, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Box, 
  Button,
  Grid
} from '@mantine/core'
import { Calendar as MantineCalendar } from '@mantine/dates'
import { 
  IconPlus, 
  IconTrendingUp, 
  IconTrendingDown, 
  IconMinus
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import apiClient from '../api'

const Calendar = () => {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    loadTrades()
  }, [])

  const loadTrades = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getTrades()
      setTrades(data)
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load trades',
        color: 'red',
      })
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

  const getProfitColor = (profit) => {
    if (profit === null) return 'gray'
    return profit > 0 ? 'green' : profit < 0 ? 'red' : 'gray'
  }

  const getProfitIcon = (profit) => {
    if (profit > 0) return <IconTrendingUp size={16} />
    if (profit < 0) return <IconTrendingDown size={16} />
    return <IconMinus size={16} />
  }

  const calculateProfit = (trade) => {
    if (trade.trade_type === 'profit_only') {
      return trade.sell_price // For profit-only trades, sell_price contains the profit
    }
    
    const isShort = trade.position_type === 'short'
    const hasRequiredData = isShort 
      ? trade.sell_price && trade.buy_price && trade.sell_date && trade.buy_date
      : trade.sell_price && trade.sell_date
    
    if (!hasRequiredData) return null
    
    // Calculate profit: (sell_price - buy_price) * shares
    return (trade.sell_price - trade.buy_price) * trade.shares
  }

  // Format currency with K notation for thousands
  const formatCurrencyCompact = (amount) => {
    if (amount === null || amount === undefined) return '$0'
    
    const absAmount = Math.abs(amount)
    if (absAmount >= 1000) {
      const kValue = (amount / 1000).toFixed(1)
      return `${amount < 0 ? '-' : ''}$${kValue}K`
    }
    return formatCurrency(amount)
  }

  // Calculate daily P&L for a specific date
  const getDailyPnL = (date) => {
    const localDateString = getLocalDateString(date)
    const dayTrades = trades.filter(trade => {
      const buyDate = trade.buy_date ? getLocalDateString(trade.buy_date) : null
      const sellDate = trade.sell_date ? getLocalDateString(trade.sell_date) : null
      return buyDate === localDateString || sellDate === localDateString
    })

    return dayTrades.reduce((total, trade) => {
      // Only count profit/loss for exit trades (when we actually close the position)
      const isExitTrade = trade.sell_date && getLocalDateString(trade.sell_date) === localDateString
      if (isExitTrade) {
        const profit = calculateProfit(trade)
        return total + (profit || 0)
      }
      return total
    }, 0)
  }

  // Helper function to get local date string (converts UTC to user's timezone)
  const getLocalDateString = (date) => {
    const utcDate = new Date(date)
    // Convert UTC date to user's local timezone
    return utcDate.toLocaleDateString('en-CA')
  }

  // Calendar day renderer
  const renderDay = (date) => {
    // Convert the date to a proper Date object
    const dateObj = new Date(date)
    const dailyPnL = getDailyPnL(dateObj)
    const hasTrades = dailyPnL !== 0

    return (
      <Box style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="sm" ta="center" fw={600} c="dark" mb={hasTrades ? 4 : 0}>
          {dateObj.getDate()}
        </Text>
        {hasTrades && (
          <Box style={{ textAlign: 'center' }}>
            <Text 
              size="xs" 
              fw={700} 
              c={getProfitColor(dailyPnL)}
              style={{ 
                fontSize: '9px',
                lineHeight: 1.2
              }}
            >
              {formatCurrencyCompact(dailyPnL)}
            </Text>
            <Box 
              style={{ 
                width: '100%', 
                height: '2px', 
                backgroundColor: getProfitColor(dailyPnL) === 'green' ? 'var(--mantine-color-green-5)' : 
                               getProfitColor(dailyPnL) === 'red' ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-gray-5)',
                borderRadius: '1px',
                marginTop: '2px'
              }}
            />
          </Box>
        )}
      </Box>
    )
  }

  if (loading) {
    return (
      <Card>
        <Text>Loading calendar...</Text>
      </Card>
    )
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2} c="dark">Trading Calendar</Title>
        <Button 
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'blue', to: 'purple' }}
        >
          Add Trade
        </Button>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Box style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
              <MantineCalendar
                value={selectedDate}
                onChange={setSelectedDate}
                renderDay={renderDay}
                size="xl"
                style={{ 
                  maxWidth: '900px',
                  width: '100%'
                }}
                styles={{
                  calendarHeader: {
                    marginBottom: '30px'
                  },
                  calendarHeaderControl: {
                    fontSize: '20px',
                    fontWeight: 600
                  },
                  calendarHeaderLevel: {
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--mantine-color-blue-7)'
                  },
                  day: {
                    height: '60px',
                    fontSize: '18px',
                    fontWeight: 500
                  },
                  weekday: {
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--mantine-color-gray-6)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }
                }}
              />
            </Box>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={3} mb="md" c="dark">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Title>
            {(() => {
              const localDateString = getLocalDateString(selectedDate)
              const dayTrades = trades.filter(trade => {
                const buyDate = trade.buy_date ? getLocalDateString(trade.buy_date) : null
                const sellDate = trade.sell_date ? getLocalDateString(trade.sell_date) : null
                return buyDate === localDateString || sellDate === localDateString
              })
              const dailyPnL = getDailyPnL(selectedDate)

              if (dayTrades.length === 0) {
                return (
                  <Box 
                    p="xl" 
                    style={{ 
                      textAlign: 'center',
                      backgroundColor: 'var(--mantine-color-gray-0)',
                      borderRadius: '8px',
                      border: '2px dashed var(--mantine-color-gray-3)'
                    }}
                  >
                    <Text size="sm" c="dimmed" fw={500}>
                      No trades on this date
                    </Text>
                    <Text size="xs" c="dimmed" mt="xs">
                      Click "Add Trade" to create a new trade
                    </Text>
                  </Box>
                )
              }

              return (
                <Stack gap="md">
                  {/* Daily P&L Summary */}
                  <Card p="md" radius="md" withBorder style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600} c="dark">
                        Daily P&L
                      </Text>
                      <Group gap="xs">
                        <ActionIcon size="sm" color={getProfitColor(dailyPnL)} variant="light">
                          {getProfitIcon(dailyPnL)}
                        </ActionIcon>
                        <Text size="lg" fw={700} c={getProfitColor(dailyPnL)}>
                          {formatCurrencyCompact(dailyPnL)}
                        </Text>
                      </Group>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''} on this date
                    </Text>
                  </Card>
                  
                  <Stack gap="xs">
                    {dayTrades.map((trade, index) => (
                      <Card 
                        key={`${trade.id}-${index}`} 
                        p="sm" 
                        radius="md" 
                        withBorder
                        style={{ 
                          backgroundColor: 'var(--mantine-color-gray-0)',
                          transition: 'all 0.2s ease'
                        }}
                        className="hover:shadow-md"
                      >
                        <Group justify="space-between">
                          <Group gap="sm">
                            <Badge 
                              color={trade.buy_date && getLocalDateString(trade.buy_date) === localDateString ? 'blue' : 'green'}
                              size="sm"
                              variant="filled"
                            >
                              {trade.buy_date && getLocalDateString(trade.buy_date) === localDateString ? 'Entry' : 'Exit'}
                            </Badge>
                            <Text size="sm" fw={600} c="dark">
                              {trade.symbol}
                            </Text>
                          </Group>
                          <Badge 
                            color={trade.position_type === 'short' ? 'red' : 'blue'}
                            size="sm"
                            variant="light"
                          >
                            {trade.position_type === 'short' ? 'Short' : 'Long'}
                          </Badge>
                        </Group>
                        {trade.notes && (
                          <Text size="xs" c="dimmed" mt="xs" lineClamp={2}>
                            {trade.notes}
                          </Text>
                        )}
                      </Card>
                    ))}
                  </Stack>
                </Stack>
              )
            })()}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

export default Calendar
