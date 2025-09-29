import { useState, useEffect } from 'react'
import { 
  Container, 
  Paper, 
  TextInput, 
  NumberInput, 
  Button, 
  Title, 
  Text, 
  Group, 
  Stack,
  Table,
  ActionIcon,
  Badge,
  Modal,
  Textarea,
  Grid,
  Card,
  Center,
  ThemeIcon,
  Menu,
  Drawer,
  ScrollArea,
  Divider,
  Skeleton
} from '@mantine/core'
import { 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconSearch, 
  IconFilter,
  IconBook,
  IconCalendar,
  IconCurrencyDollar,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus
} from '@tabler/icons-react'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import apiClient from '../api'

const TradingNotes = () => {
  const [trades, setTrades] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [opened, { open, close }] = useDisclosure(false)
  const [editingTrade, setEditingTrade] = useState(null)

  const form = useForm({
    initialValues: {
      symbol: '',
      shares: 0,
      buyPrice: 0,
      buyDate: '',
      sellPrice: '',
      sellDate: '',
      notes: ''
    },
    validate: {
      symbol: (value) => (!value ? 'Symbol is required' : null),
      shares: (value) => (value <= 0 ? 'Shares must be greater than 0' : null),
      buyPrice: (value) => (value <= 0 ? 'Buy price must be greater than 0' : null),
      buyDate: (value) => (!value ? 'Buy date is required' : null),
    },
  })

  useEffect(() => {
    loadTrades()
  }, [])

  const loadTrades = async () => {
    try {
      setLoading(true)
      const trades = await apiClient.getTrades()
      setTrades(trades)
    } catch (error) {
      console.error('Error loading trades:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to load trades',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (values) => {
    try {
      const tradeData = {
        symbol: values.symbol.toUpperCase(),
        shares: parseInt(values.shares),
        buyPrice: parseFloat(values.buyPrice),
        sellPrice: values.sellPrice ? parseFloat(values.sellPrice) : null,
        buyDate: values.buyDate,
        sellDate: values.sellDate || null,
        notes: values.notes || null
      }

      if (editingTrade) {
        await apiClient.updateTrade(editingTrade.id, tradeData)
        notifications.show({
          title: 'Success',
          message: 'Trade updated successfully',
          color: 'green',
        })
      } else {
        await apiClient.createTrade(tradeData)
        notifications.show({
          title: 'Success',
          message: 'Trade added successfully',
          color: 'green',
        })
      }

      await loadTrades()
      close()
      form.reset()
      setEditingTrade(null)
    } catch (error) {
      console.error('Error saving trade:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to save trade',
        color: 'red',
      })
    }
  }

  const handleEdit = (trade) => {
    setEditingTrade(trade)
    form.setValues({
      symbol: trade.symbol,
      shares: trade.shares,
      buyPrice: trade.buy_price,
      buyDate: trade.buy_date ? new Date(trade.buy_date).toISOString().split('T')[0] : '',
      sellPrice: trade.sell_price || '',
      sellDate: trade.sell_date ? new Date(trade.sell_date).toISOString().split('T')[0] : '',
      notes: trade.notes || ''
    })
    open()
  }

  const handleDelete = async (tradeId) => {
    try {
      await apiClient.deleteTrade(tradeId)
      notifications.show({
        title: 'Success',
        message: 'Trade deleted successfully',
        color: 'green',
      })
      await loadTrades()
    } catch (error) {
      console.error('Error deleting trade:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to delete trade',
        color: 'red',
      })
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getProfit = (trade) => {
    if (!trade.sell_price || !trade.sell_date) return null
    return (trade.sell_price - trade.buy_price) * trade.shares
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

  const getStatus = (trade) => {
    return trade.sell_price && trade.sell_date ? 'closed' : 'open'
  }

  const filteredTrades = trades.filter(trade => {
    const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (trade.notes && trade.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesFilter = filterStatus === 'all' || getStatus(trade) === filterStatus
    return matchesSearch && matchesFilter
  })

  const rows = filteredTrades.map((trade) => {
    const profit = getProfit(trade)
    const status = getStatus(trade)
    
    return (
      <Table.Tr key={trade.id}>
        <Table.Td>
          <Group gap="sm">
            <Text fw={600}>{trade.symbol}</Text>
            <Badge 
              color={status === 'open' ? 'blue' : 'gray'}
              variant="light"
              size="sm"
            >
              {status === 'open' ? 'Open' : 'Closed'}
            </Badge>
          </Group>
        </Table.Td>
        <Table.Td>{trade.shares}</Table.Td>
        <Table.Td>{formatCurrency(trade.buy_price)}</Table.Td>
        <Table.Td>{formatDate(trade.buy_date)}</Table.Td>
        <Table.Td>
          {trade.sell_price ? formatCurrency(trade.sell_price) : '-'}
        </Table.Td>
        <Table.Td>
          {trade.sell_date ? formatDate(trade.sell_date) : '-'}
        </Table.Td>
        <Table.Td>
          {profit !== null ? (
            <Group gap="xs">
              <ActionIcon size="sm" color={getProfitColor(profit)} variant="light">
                {getProfitIcon(profit)}
              </ActionIcon>
              <Text fw={500} c={getProfitColor(profit)}>
                {formatCurrency(profit)}
              </Text>
            </Group>
          ) : (
            <Text c="dimmed" size="sm">Open</Text>
          )}
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={() => handleEdit(trade)}
            >
              <IconEdit size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => handleDelete(trade.id)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    )
  })

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <div>
            <Skeleton height={32} width={300} mb="sm" />
            <Skeleton height={20} width={400} />
          </div>
          <Skeleton height={400} />
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1} mb="sm">Trading Notes</Title>
            <Text c="dimmed" size="lg">Manage your trading positions and track performance</Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditingTrade(null)
              form.reset()
              open()
            }}
            variant="gradient"
            gradient={{ from: 'blue', to: 'purple' }}
            size="md"
          >
            Add Trade
          </Button>
        </Group>

        {/* Filters */}
        <Card withBorder p="md">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                placeholder="Search by symbol or notes..."
                leftSection={<IconSearch size={16} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Menu>
                <Menu.Target>
                  <Button variant="outline" leftSection={<IconFilter size={16} />}>
                    Filter: {filterStatus === 'all' ? 'All Trades' : filterStatus === 'open' ? 'Open Positions' : 'Closed Positions'}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => setFilterStatus('all')}>All Trades</Menu.Item>
                  <Menu.Item onClick={() => setFilterStatus('open')}>Open Positions</Menu.Item>
                  <Menu.Item onClick={() => setFilterStatus('closed')}>Closed Positions</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Trades Table */}
        {filteredTrades.length > 0 ? (
          <Card withBorder>
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Symbol</Table.Th>
                    <Table.Th>Shares</Table.Th>
                    <Table.Th>Buy Price</Table.Th>
                    <Table.Th>Buy Date</Table.Th>
                    <Table.Th>Sell Price</Table.Th>
                    <Table.Th>Sell Date</Table.Th>
                    <Table.Th>Profit/Loss</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        ) : (
          <Card withBorder>
            <Center py="xl">
              <Stack align="center" gap="md">
                <ThemeIcon size="xl" variant="light" color="gray">
                  <IconBook size={32} />
                </ThemeIcon>
                <div style={{ textAlign: 'center' }}>
                  <Text size="lg" fw={500} mb="xs">
                    {searchTerm || filterStatus !== 'all' ? 'No trades found' : 'No trades yet'}
                  </Text>
                  <Text c="dimmed" mb="md">
                    {searchTerm || filterStatus !== 'all' 
                      ? 'Try adjusting your search or filter criteria'
                      : 'Start by adding your first trade'
                    }
                  </Text>
                  {!searchTerm && filterStatus === 'all' && (
                    <Button
                      leftSection={<IconPlus size={16} />}
                      onClick={() => {
                        setEditingTrade(null)
                        form.reset()
                        open()
                      }}
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'purple' }}
                    >
                      Add Your First Trade
                    </Button>
                  )}
                </div>
              </Stack>
            </Center>
          </Card>
        )}

        {/* Add/Edit Modal */}
        <Modal
          opened={opened}
          onClose={close}
          title={editingTrade ? 'Edit Trade' : 'Add New Trade'}
          size="lg"
        >
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Symbol"
                    placeholder="e.g., AAPL"
                    {...form.getInputProps('symbol')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Shares"
                    placeholder="Number of shares"
                    min={1}
                    {...form.getInputProps('shares')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Buy Price"
                    placeholder="0.00"
                    min={0}
                    decimalScale={2}
                    prefix="$"
                    {...form.getInputProps('buyPrice')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Buy Date"
                    type="date"
                    {...form.getInputProps('buyDate')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Sell Price"
                    placeholder="0.00"
                    min={0}
                    decimalScale={2}
                    prefix="$"
                    {...form.getInputProps('sellPrice')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Sell Date"
                    type="date"
                    {...form.getInputProps('sellDate')}
                  />
                </Grid.Col>
              </Grid>
              
              <Textarea
                label="Notes"
                placeholder="Additional notes about this trade..."
                rows={3}
                {...form.getInputProps('notes')}
              />
              
              <Group justify="flex-end" mt="md">
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" variant="gradient" gradient={{ from: 'blue', to: 'purple' }}>
                  {editingTrade ? 'Update Trade' : 'Add Trade'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  )
}

export default TradingNotes