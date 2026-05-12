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
  Grid,
  ActionIcon,
  Modal,
  TextInput,
  NumberInput,
  Textarea,
  SegmentedControl
} from '@mantine/core'
import { Calendar as MantineCalendar } from '@mantine/dates'
import { 
  IconPlus, 
  IconTrendingUp, 
  IconTrendingDown, 
  IconMinus
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useDisclosure } from '@mantine/hooks'
import { useForm } from '@mantine/form'
import apiClient from '../api'

const Calendar = () => {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [tradeMode, setTradeMode] = useState('regular')
  const [opened, { open, close }] = useDisclosure(false)

  const form = useForm({
    initialValues: {
      symbol: '',
      shares: 0,
      buyPrice: 0,
      buyDate: '',
      sellPrice: '',
      sellDate: '',
      notes: '',
      profit: undefined,
      positionType: 'long',
      optionType: 'call',
      strikePrice: 0,
      expirationDate: '',
      contracts: 1,
      avgPrice: '',
    },
    validate: (values) => {
      if (tradeMode === 'profit') {
        return {
          symbol: (!values.symbol ? 'Symbol is required' : null),
          profit: (values.profit === undefined || values.profit === null || values.profit === '' ? 'Profit/Loss is required' : null),
          buyDate: (!values.buyDate ? 'Trade date is required' : null),
        }
      } else if (tradeMode === 'option') {
        return {
          symbol: (!values.symbol ? 'Symbol is required' : null),
          contracts: (values.contracts <= 0 ? 'Contracts must be greater than 0' : null),
          buyPrice: (values.buyPrice <= 0 ? 'Premium must be greater than 0' : null),
          strikePrice: (values.strikePrice <= 0 ? 'Strike price is required' : null),
          buyDate: (!values.buyDate ? 'Open date is required' : null),
          expirationDate: (!values.expirationDate ? 'Expiration date is required' : null),
        }
      } else {
        return {
          symbol: (!values.symbol ? 'Symbol is required' : null),
          shares: (values.shares <= 0 ? 'Shares must be greater than 0' : null),
          buyPrice: (values.buyPrice <= 0 ? 'Buy price must be greater than 0' : null),
          buyDate: (!values.buyDate ? 'Buy date is required' : null),
        }
      }
    },
  })

  const handleSubmit = async (values) => {
    try {
      let tradeData
      if (tradeMode === 'profit') {
        tradeData = {
          symbol: values.symbol.toUpperCase(),
          profit: parseFloat(values.profit),
          buyDate: values.buyDate,
          notes: values.notes || null,
          positionType: values.positionType || 'long',
          tradeType: 'profit_only',
        }
      } else if (tradeMode === 'option') {
        tradeData = {
          symbol: values.symbol.toUpperCase(),
          contracts: parseInt(values.contracts),
          buyPrice: parseFloat(values.buyPrice),
          sellPrice: null,
          buyDate: values.buyDate,
          sellDate: null,
          notes: values.notes || null,
          positionType: values.positionType || 'short',
          tradeType: 'option',
          optionType: values.optionType,
          strikePrice: parseFloat(values.strikePrice),
          expirationDate: values.expirationDate,
          avgPrice: values.avgPrice !== '' && values.avgPrice !== undefined ? parseFloat(values.avgPrice) : null,
        }
      } else {
        tradeData = {
          symbol: values.symbol.toUpperCase(),
          shares: parseInt(values.shares),
          buyPrice: parseFloat(values.buyPrice),
          sellPrice: values.sellPrice ? parseFloat(values.sellPrice) : null,
          buyDate: values.buyDate,
          sellDate: values.sellDate || null,
          notes: values.notes || null,
          positionType: values.positionType || 'long',
          tradeType: 'regular',
        }
      }

      await apiClient.createTrade(tradeData)
      notifications.show({
        title: 'Success',
        message: 'Trade added successfully',
        color: 'green',
      })
      await loadTrades()
      close()
      form.reset()
    } catch (error) {
      console.error('Error saving trade:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to save trade',
        color: 'red',
      })
    }
  }

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
      return parseFloat(trade.sell_price)
    }

    if (trade.trade_type === 'option') {
      const isShort = trade.position_type === 'short'
      const premium = parseFloat(trade.buy_price)
      // buy_price is the total premium collected/paid
      return isShort ? premium : -premium
    }

    const isShort = trade.position_type === 'short'
    const hasRequiredData = isShort
      ? trade.sell_price && trade.buy_price && trade.sell_date && trade.buy_date
      : trade.sell_price && trade.sell_date
    if (!hasRequiredData) return null
    return (trade.sell_price - trade.buy_price) * trade.shares
  }

  // Format currency with K notation for thousands — kept for reference but not used
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
      const isOption = trade.trade_type === 'option'
      const buyDate = trade.buy_date ? getLocalDateString(trade.buy_date) : null
      const sellDate = trade.sell_date ? getLocalDateString(trade.sell_date) : null

      // Options: count premium on the open (buy) date
      if (isOption && buyDate === localDateString) {
        const profit = calculateProfit(trade)
        return total + (profit || 0)
      }
      // All other trades: count P&L on exit (sell) date
      const isExitTrade = sellDate === localDateString
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
    const dateObj = new Date(date)
    const dailyPnL = getDailyPnL(dateObj)
    const hasTrades = dailyPnL !== 0

    return (
      <Box
        onClick={() => setSelectedDate(dateObj)}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
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
              {formatCurrency(dailyPnL)}
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
          onClick={() => {
            setTradeMode('regular')
            form.reset()
            open()
          }}
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
                          {formatCurrency(dailyPnL)}
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
                            color={trade.trade_type === 'option'
                              ? (trade.position_type === 'short' ? 'orange' : 'grape')
                              : (trade.position_type === 'short' ? 'red' : 'blue')}
                            size="sm"
                            variant="light"
                          >
                            {trade.trade_type === 'option'
                              ? (trade.position_type === 'short'
                                  ? (trade.option_type === 'call' ? 'Covered Call' : 'Put Sell')
                                  : (trade.option_type === 'call' ? 'Call Buy' : 'Put Buy'))
                              : (trade.position_type === 'short' ? 'Short' : 'Long')}
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

      {/* Add Trade Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title="Add New Trade"
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Group justify="center" mb="md">
              <SegmentedControl
                value={tradeMode}
                onChange={(value) => {
                  setTradeMode(value)
                  form.reset()
                  if (value === 'option') form.setFieldValue('positionType', 'short')
                }}
                data={[
                  { label: 'Regular', value: 'regular' },
                  { label: 'Option', value: 'option' },
                  { label: 'Profit Only', value: 'profit' },
                ]}
                size="sm"
              />
            </Group>

            {tradeMode === 'profit' ? (
              <Grid>
                <Grid.Col span={6}>
                  <TextInput label="Symbol" placeholder="e.g., AAPL" {...form.getInputProps('symbol')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput label="Profit/Loss" placeholder="0.00" decimalScale={2} prefix="$" {...form.getInputProps('profit')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput label="Trade Date" type="date" {...form.getInputProps('buyDate')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <div>
                    <Text size="sm" fw={500} mb="xs">Position Type</Text>
                    <SegmentedControl
                      data={[{ label: 'Long', value: 'long' }, { label: 'Short', value: 'short' }]}
                      value={form.values.positionType}
                      onChange={(value) => form.setFieldValue('positionType', value)}
                    />
                  </div>
                </Grid.Col>
              </Grid>
            ) : tradeMode === 'option' ? (
              <Grid>
                <Grid.Col span={6}>
                  <TextInput label="Symbol" placeholder="e.g., AAPL" {...form.getInputProps('symbol')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <div>
                    <Text size="sm" fw={500} mb="xs">Option Type</Text>
                    <SegmentedControl
                      data={[{ label: 'Call', value: 'call' }, { label: 'Put', value: 'put' }]}
                      value={form.values.optionType}
                      onChange={(value) => form.setFieldValue('optionType', value)}
                      fullWidth
                    />
                  </div>
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput label="Strike Price" placeholder="150.00" min={0} decimalScale={2} prefix="$" {...form.getInputProps('strikePrice')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput label="Avg Stock Price" placeholder="148.50" min={0} decimalScale={2} prefix="$" {...form.getInputProps('avgPrice')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput label="Expiration Date" type="date" {...form.getInputProps('expirationDate')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput label="Contracts" placeholder="1" min={1} {...form.getInputProps('contracts')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <div>
                    <Text size="sm" fw={500} mb="xs">Action</Text>
                    <SegmentedControl
                      data={[{ label: 'Covered Call', value: 'short' }, { label: 'Buy', value: 'long' }]}
                      value={form.values.positionType}
                      onChange={(value) => form.setFieldValue('positionType', value)}
                      fullWidth
                    />
                  </div>
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label={form.values.positionType === 'short' ? 'Premium Received' : 'Premium Paid'}
                    placeholder="2.50"
                    min={0}
                    decimalScale={2}
                    prefix="$"
                    {...form.getInputProps('buyPrice')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput label="Open Date" type="date" {...form.getInputProps('buyDate')} />
                </Grid.Col>
              </Grid>
            ) : (
              <Grid>
                <Grid.Col span={6}>
                  <TextInput label="Symbol" placeholder="e.g., AAPL" {...form.getInputProps('symbol')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput label="Shares" placeholder="Number of shares" min={1} {...form.getInputProps('shares')} />
                </Grid.Col>
                <Grid.Col span={12}>
                  <div>
                    <Text size="sm" fw={500} mb="xs">Position Type</Text>
                    <SegmentedControl
                      data={[{ label: 'Long', value: 'long' }, { label: 'Short', value: 'short' }]}
                      value={form.values.positionType}
                      onChange={(value) => form.setFieldValue('positionType', value)}
                    />
                  </div>
                </Grid.Col>
                {form.values.positionType === 'short' ? (
                  <>
                    <Grid.Col span={6}>
                      <NumberInput label="Sell Price (Entry)" placeholder="0.00" min={0} decimalScale={2} prefix="$" {...form.getInputProps('sellPrice')} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <NumberInput label="Buy Price (Exit)" placeholder="0.00" min={0} decimalScale={2} prefix="$" {...form.getInputProps('buyPrice')} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput label="Sell Date (Entry)" type="date" {...form.getInputProps('sellDate')} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput label="Buy Date (Exit)" type="date" {...form.getInputProps('buyDate')} />
                    </Grid.Col>
                  </>
                ) : (
                  <>
                    <Grid.Col span={6}>
                      <NumberInput label="Buy Price (Entry)" placeholder="0.00" min={0} decimalScale={2} prefix="$" {...form.getInputProps('buyPrice')} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <NumberInput label="Sell Price (Exit)" placeholder="0.00" min={0} decimalScale={2} prefix="$" {...form.getInputProps('sellPrice')} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput label="Buy Date (Entry)" type="date" {...form.getInputProps('buyDate')} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput label="Sell Date (Exit)" type="date" {...form.getInputProps('sellDate')} />
                    </Grid.Col>
                  </>
                )}
              </Grid>
            )}

            <Textarea
              label="Notes"
              placeholder="Additional notes about this trade..."
              rows={3}
              {...form.getInputProps('notes')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" variant="gradient" gradient={{ from: 'blue', to: 'purple' }}>
                Add Trade
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}

export default Calendar
