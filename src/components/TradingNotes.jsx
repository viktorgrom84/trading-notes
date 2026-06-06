import { useState, useEffect, useRef } from 'react'
import { 
  Container, 
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
  ScrollArea,
  Skeleton,
  SegmentedControl,
  Tooltip,
  Pagination,
  Select,
  Flex
} from '@mantine/core'
import { 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconSearch, 
  IconFilter,
  IconBook,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
} from '@tabler/icons-react'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import apiClient from '../api'
import { useTrades } from '../context/TradesContext'
import { formatCurrency, formatDate, getProfitColor, toInputDate } from '../utils/format'
import { tradeProfit } from '../utils/tradeProfit'

const VALID_STATUSES = ['all', 'open', 'closed']

const TradingNotes = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { trades, loading, refresh } = useTrades()

  // Initialise from URL — ?q= and ?status=
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '')
  const [filterStatus, setFilterStatus] = useState(() =>
    VALID_STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : 'all'
  )

  const updateSearch = (q) => {
    setSearchTerm(q)
    setSearchParams(p => { const n = new URLSearchParams(p); q ? n.set('q', q) : n.delete('q'); return n }, { replace: true })
  }
  const updateStatus = (s) => {
    setFilterStatus(s)
    setSearchParams(p => { const n = new URLSearchParams(p); s !== 'all' ? n.set('status', s) : n.delete('status'); return n }, { replace: true })
  }
  const [opened, { open, close }] = useDisclosure(false)
  const [editingTrade, setEditingTrade] = useState(null)
  const [tradeMode, setTradeMode] = useState('regular') // 'regular' | 'option' | 'profit'
  const [returnPath, setReturnPath] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, afterDelete? }

  const handleClose = () => {
    close()
    form.reset()
    setEditingTrade(null)
    if (returnPath) {
      const path = returnPath
      setReturnPath(null)
      navigate(path)
    }
  }
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

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
      // Option-specific
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

  // Auto-populate Notes when option fields change
  const autoNoteRef = useRef('')
  useEffect(() => {
    if (tradeMode !== 'option') return

    const { symbol, optionType, strikePrice, expirationDate, avgPrice, contracts, buyPrice, positionType } = form.values
    const type = optionType === 'call' ? 'CALL' : 'PUT'
    const action = positionType === 'short' ? 'Covered Call' : 'Buy'
    const parts = []

    if (symbol)      parts.push(symbol.toUpperCase())
    if (type)        parts.push(`${type}`)
    if (strikePrice) parts.push(`Strike: $${parseFloat(strikePrice).toFixed(2)}`)
    if (expirationDate) {
      const d = new Date(expirationDate + 'T12:00:00')
      parts.push(`Exp: ${d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`)
    }
    if (avgPrice !== '' && avgPrice !== undefined && avgPrice !== null)
      parts.push(`Avg: $${parseFloat(avgPrice).toFixed(2)}`)
    if (contracts && contracts > 0)
      parts.push(`${contracts} contract${contracts > 1 ? 's' : ''}`)
    if (buyPrice && buyPrice > 0)
      parts.push(`Premium: $${parseFloat(buyPrice).toFixed(2)}`)
    if (form.values.buyDate) {
      const od = new Date(form.values.buyDate + 'T12:00:00')
      parts.push(`Opened: ${od.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`)
    }
    parts.push(action)

    const generated = parts.join(' · ')

    // Only overwrite if the note is still empty or was previously auto-generated
    if (form.values.notes === '' || form.values.notes === autoNoteRef.current) {
      autoNoteRef.current = generated
      form.setFieldValue('notes', generated)
    }
  }, [tradeMode, form.values.symbol, form.values.optionType, form.values.strikePrice, form.values.expirationDate, form.values.avgPrice, form.values.contracts, form.values.buyPrice, form.values.positionType, form.values.buyDate])

  // Deep-link: /trades?id=X opens edit modal
  useEffect(() => {
    const targetId = searchParams.get('id')
      ? parseInt(searchParams.get('id'))
      : location.state?.openTradeId
    if (!targetId || loading || trades.length === 0) return
    const trade = trades.find(t => t.id === targetId)
    if (trade) {
      const ret = searchParams.get('returnTo')
      if (ret) setReturnPath(ret)
      handleEdit(trade)
      open()
      navigate('/trades', { replace: true, state: {} })
    }
  }, [searchParams.get('id'), location.state?.openTradeId, loading, trades])

  // Pre-fill new profit-only form from assignment: /trades?prefill=profit_only&symbol=X&profit=Y&date=D
  useEffect(() => {
    if (searchParams.get('prefill') !== 'profit_only') return
    const symbol = searchParams.get('symbol') ?? ''
    const profit = parseFloat(searchParams.get('profit') ?? '0')
    const date   = searchParams.get('date') ?? ''
    setTradeMode('profit')
    setEditingTrade(null)
    form.setValues({
      symbol,
      profit: isNaN(profit) ? 0 : profit,
      buyDate: date,
      // reset everything else
      shares: 0, buyPrice: 0, sellPrice: '', sellDate: '', notes: '',
      positionType: 'long', optionType: 'call', strikePrice: 0,
      expirationDate: '', contracts: 1, avgPrice: '',
    })
    open()
    navigate('/trades', { replace: true, state: {} })
  }, [searchParams.get('prefill')])

  const handleSubmit = async (values) => {
    try {
      let tradeData;
      
      if (tradeMode === 'profit') {
        tradeData = {
          symbol: values.symbol.toUpperCase(),
          profit: parseFloat(values.profit),
          buyDate: values.buyDate,
          notes: values.notes || null,
          positionType: values.positionType || 'long',
          tradeType: 'profit_only'
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
          tradeType: 'regular'
        }
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

      await refresh()
      handleClose()
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
    const isProfitOnly = isProfitOnlyTrade(trade)
    const isOption = isOptionTrade(trade)
    if (isOption) setTradeMode('option')
    else if (isProfitOnly) setTradeMode('profit')
    else setTradeMode('regular')

    // Seed the auto-note ref with the trade's current notes so that any
    // field change will correctly trigger a regeneration
    autoNoteRef.current = trade.notes || ''

    if (isOption) {
      form.setValues({
        symbol: trade.symbol,
        contracts: trade.shares,
        buyPrice: trade.buy_price,
        sellPrice: trade.sell_price ?? '',
        buyDate: toInputDate(trade.buy_date),
        sellDate: toInputDate(trade.sell_date) ?? '',
        notes: trade.notes || '',
        positionType: trade.position_type || 'short',
        optionType: trade.option_type || 'call',
        strikePrice: trade.strike_price || 0,
        expirationDate: toInputDate(trade.expiration_date),
        avgPrice: trade.avg_price !== null && trade.avg_price !== undefined ? trade.avg_price : '',
        shares: 0,
        profit: undefined,
      })
    } else if (isProfitOnly) {
      form.setValues({
        symbol: trade.symbol,
        profit: trade.sell_price || 0,
        buyDate: toInputDate(trade.buy_date),
        notes: cleanNotes(trade.notes),
        positionType: trade.position_type || 'long',
        shares: 0, buyPrice: 0, sellPrice: '', sellDate: '',
        optionType: 'call', strikePrice: 0, expirationDate: '', contracts: 1,
      })
    } else {
      form.setValues({
        symbol: trade.symbol,
        profit: undefined,
        buyDate: toInputDate(trade.buy_date),
        notes: trade.notes || '',
        positionType: trade.position_type || 'long',
        shares: trade.shares,
        buyPrice: trade.buy_price,
        sellPrice: trade.sell_price || '',
        sellDate: toInputDate(trade.sell_date),
        optionType: 'call', strikePrice: 0, expirationDate: '', contracts: 1,
      })
    }
    
    open()
  }

  const confirmDelete = (tradeId, afterDelete) => {
    setDeleteTarget({ id: tradeId, afterDelete })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { id, afterDelete } = deleteTarget
    setDeleteTarget(null)
    try {
      await apiClient.deleteTrade(id)
      notifications.show({
        title: 'Success',
        message: 'Trade deleted successfully',
        color: 'green',
      })
      await refresh()
      if (afterDelete) afterDelete()
    } catch (error) {
      console.error('Error deleting trade:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to delete trade',
        color: 'red',
      })
    }
  }

  const isProfitOnlyTrade = (trade) => {
    if (trade.trade_type === 'profit_only') return true
    if (trade.trade_type === 'regular' || trade.trade_type === 'option') return false
    return trade.shares === 1 && trade.buy_price === 0 && trade.sell_price && trade.sell_price !== 0
  }

  const isOptionTrade = (trade) => trade.trade_type === 'option'
  const isShortTrade = (trade) => trade.position_type === 'short'

  const getProfitIcon = (profit) => {
    if (profit > 0) return <IconTrendingUp size={16} />
    if (profit < 0) return <IconTrendingDown size={16} />
    return <IconMinus size={16} />
  }

  const cleanNotes = (notes) => notes ? notes.replace(/^Profit-only trade: [+\-]?[\d,]+\.?\d*\s*/, '') : ''
  
  const getDisplayNotes = (trade) => {
    if (!trade.notes || trade.notes.trim() === '') return ''
    return cleanNotes(trade.notes)
  }

  const getStatus = (trade) => {
    if (isProfitOnlyTrade(trade)) return 'closed'
    if (isOptionTrade(trade)) return trade.sell_date ? 'closed' : 'open'
    const isShort = isShortTrade(trade)
    if (isShort) {
      return (trade.sell_price && trade.sell_date && trade.buy_price && trade.buy_date) ? 'closed' : 'open'
    }
    return trade.sell_price && trade.sell_date ? 'closed' : 'open'
  }

  const filteredTrades = (trades || [])
    .filter(trade => {
      const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (trade.notes && trade.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesFilter = filterStatus === 'all' || getStatus(trade) === filterStatus
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      // Sort by entry date (buy_date) in descending order (newest first)
      const dateA = new Date(a.buy_date || 0)
      const dateB = new Date(b.buy_date || 0)
      return dateB - dateA
    })

  // Pagination logic
  const totalTrades = filteredTrades.length
  const totalPages = Math.ceil(totalTrades / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTrades = filteredTrades.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus, pageSize])

  // Helper functions for table display
  const getEntryPrice = (trade) => {
    if (isProfitOnlyTrade(trade)) return '-'
    if (isOptionTrade(trade)) return formatCurrency(trade.buy_price)
    return isShortTrade(trade) ? formatCurrency(trade.sell_price) : formatCurrency(trade.buy_price)
  }
  
  const getEntryDate = (trade) => {
    if (isOptionTrade(trade)) return formatDate(trade.buy_date)
    return isShortTrade(trade) ? formatDate(trade.sell_date) : formatDate(trade.buy_date)
  }
  
  const getExitPrice = (trade) => {
    if (isProfitOnlyTrade(trade)) return '-'
    if (isOptionTrade(trade)) return trade.sell_price ? formatCurrency(trade.sell_price) : '-'
    return isShortTrade(trade) 
      ? (trade.buy_price ? formatCurrency(trade.buy_price) : '-')
      : (trade.sell_price ? formatCurrency(trade.sell_price) : '-')
  }
  
  const getExitDate = (trade) => {
    if (isOptionTrade(trade)) return trade.sell_date ? formatDate(trade.sell_date) : '-'
    return isShortTrade(trade) 
      ? (trade.buy_date ? formatDate(trade.buy_date) : '-')
      : (trade.sell_date ? formatDate(trade.sell_date) : '-')
  }

  const rows = paginatedTrades.map((trade) => {
    const profit = tradeProfit(trade)
    const status = getStatus(trade)
    const isProfitOnly = isProfitOnlyTrade(trade)
    const isOption = isOptionTrade(trade)
    const isShort = isShortTrade(trade)

    const optionTooltip = isOption
      ? `${trade.option_type?.toUpperCase()} • Strike $${parseFloat(trade.strike_price).toFixed(2)}${trade.avg_price ? ` • Avg $${parseFloat(trade.avg_price).toFixed(2)}` : ''} • Exp ${formatDate(trade.expiration_date)}${getDisplayNotes(trade) ? '\n' + getDisplayNotes(trade) : ''}`
      : getDisplayNotes(trade)
    
    return (
      <Table.Tr key={trade.id}>
        <Table.Td>
          <Group gap="sm">
            <Tooltip
              label={optionTooltip}
              position="top"
              withArrow
              multiline
              w={300}
              disabled={!optionTooltip}
            >
              <div style={{ cursor: optionTooltip ? 'help' : 'default' }}>
                <Text fw={600}>{trade.symbol}</Text>
                {isOption && (
                  <Text size="xs" c="dimmed">
                    {trade.option_type?.toUpperCase()} ${parseFloat(trade.strike_price || 0).toFixed(2)} · {formatDate(trade.expiration_date)}{trade.avg_price ? ` · Avg $${parseFloat(trade.avg_price).toFixed(2)}` : ''}
                  </Text>
                )}
              </div>
            </Tooltip>
            {status === 'closed' && (
              <Badge color="gray" variant="light" size="sm">Closed</Badge>
            )}
          </Group>
        </Table.Td>
        <Table.Td>
          {isOption ? (
            <Badge
              color={isShort ? 'orange' : 'violet'}
              variant="light"
              size="sm"
              leftSection={isShort ? <IconTrendingDown size={12} /> : <IconTrendingUp size={12} />}
            >
              {isShort && trade.option_type === 'call'
                ? 'Covered Call'
                : isShort && trade.option_type === 'put'
                  ? 'Short Put'
                  : trade.option_type === 'call'
                    ? 'Long Call'
                    : 'Long Put'}
            </Badge>
          ) : (
            <Badge 
              color={isShort ? 'red' : 'green'}
              variant="light"
              size="sm"
              leftSection={isShort ? <IconTrendingDown size={12} /> : <IconTrendingUp size={12} />}
            >
              {isShort ? 'Short' : 'Long'}
            </Badge>
          )}
        </Table.Td>
        <Table.Td>
          {isProfitOnly ? '-' : isOption ? `${trade.shares}` : trade.shares}
        </Table.Td>
        <Table.Td>
          {getEntryPrice(trade)}
        </Table.Td>
        <Table.Td>
          {getEntryDate(trade)}
        </Table.Td>
        <Table.Td>
          {getExitPrice(trade)}
        </Table.Td>
        <Table.Td>
          {getExitDate(trade)}
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
          ) : isOption && status === 'open' ? (
            <Group gap="xs">
              <ActionIcon size="sm" color={isShort ? 'green' : 'red'} variant="light">
                {isShort ? <IconTrendingUp size={16} /> : <IconTrendingDown size={16} />}
              </ActionIcon>
              <Text fw={500} c={isShort ? 'green' : 'red'} size="sm">
                {formatCurrency(parseFloat(trade.buy_price))}
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
              onClick={() => confirmDelete(trade.id)}
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
          <Skeleton height={400} data-testid="skeleton" />
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
              setTradeMode('regular')
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
                onChange={(e) => updateSearch(e.target.value)}
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
                  <Menu.Item onClick={() => updateStatus('all')}>All Trades</Menu.Item>
                  <Menu.Item onClick={() => updateStatus('open')}>Open Positions</Menu.Item>
                  <Menu.Item onClick={() => updateStatus('closed')}>Closed Positions</Menu.Item>
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
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Qty</Table.Th>
                    <Table.Th>Premium / Entry</Table.Th>
                    <Table.Th>Open Date</Table.Th>
                    <Table.Th>Close / Exit</Table.Th>
                    <Table.Th>Close Date</Table.Th>
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
                        setTradeMode('regular')
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

        {/* Pagination Controls */}
        {filteredTrades.length > 0 && (
          <Card withBorder>
            <Flex justify="space-between" align="center" wrap="wrap" gap="md">
              <Group gap="md">
                <Text size="sm" c="dimmed">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalTrades)} of {totalTrades} trades
                </Text>
                <Select
                  size="sm"
                  value={pageSize.toString()}
                  onChange={(value) => setPageSize(parseInt(value))}
                  data={[
                    { value: '10', label: '10 per page' },
                    { value: '25', label: '25 per page' },
                    { value: '50', label: '50 per page' },
                    { value: '100', label: '100 per page' }
                  ]}
                  w={140}
                />
              </Group>
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                size="sm"
                withEdges
              />
            </Flex>
          </Card>
        )}

        {/* Add/Edit Modal */}
        <Modal
          opened={opened}
          onClose={handleClose}
          title={editingTrade ? 'Edit Trade' : 'Add New Trade'}
          size="lg"
        >
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              {/* Mode Toggle */}
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
                    { label: 'Profit Only', value: 'profit' }
                  ]}
                  size="sm"
                  disabled={editingTrade !== null}
                />
              </Group>

              {tradeMode === 'profit' ? (
                // Profit-only mode fields
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
                      label="Profit/Loss"
                      placeholder="0.00"
                      decimalScale={2}
                      prefix="$"
                      {...form.getInputProps('profit')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Trade Date"
                      type="date"
                      {...form.getInputProps('buyDate')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <div>
                      <Text size="sm" fw={500} mb="xs">Position Type</Text>
                      <SegmentedControl
                        data={[
                          { label: 'Long', value: 'long' },
                          { label: 'Short', value: 'short' }
                        ]}
                        value={form.values.positionType}
                        onChange={(value) => form.setFieldValue('positionType', value)}
                      />
                    </div>
                  </Grid.Col>
                </Grid>
              ) : tradeMode === 'option' ? (
                // Option mode fields
                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Symbol"
                      placeholder="e.g., AAPL"
                      {...form.getInputProps('symbol')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <div>
                      <Text size="sm" fw={500} mb="xs">Option Type</Text>
                      <SegmentedControl
                        data={[
                          { label: 'Call', value: 'call' },
                          { label: 'Put', value: 'put' }
                        ]}
                        value={form.values.optionType}
                        onChange={(value) => form.setFieldValue('optionType', value)}
                        fullWidth
                      />
                    </div>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Strike Price"
                      placeholder="150.00"
                      min={0}
                      decimalScale={2}
                      prefix="$"
                      {...form.getInputProps('strikePrice')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Avg Stock Price"
                      placeholder="148.50"
                      min={0}
                      decimalScale={2}
                      prefix="$"
                      {...form.getInputProps('avgPrice')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Expiration Date"
                      type="date"
                      {...form.getInputProps('expirationDate')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Contracts"
                      placeholder="1"
                      min={1}
                      {...form.getInputProps('contracts')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <div>
                      <Text size="sm" fw={500} mb="xs">Action</Text>
                      <SegmentedControl
                        data={[
                          { label: 'Covered Call', value: 'short' },
                          { label: 'Buy', value: 'long' }
                        ]}
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
                    <TextInput
                      label="Open Date"
                      type="date"
                      {...form.getInputProps('buyDate')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Close Price (optional)"
                      placeholder="0.00"
                      min={0}
                      decimalScale={2}
                      prefix="$"
                      {...form.getInputProps('sellPrice')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Close Date (optional)"
                      description="Leave blank to keep as open position."
                      type="date"
                      {...form.getInputProps('sellDate')}
                    />
                  </Grid.Col>
                </Grid>
              ) : (
                // Regular mode fields
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
                  
                  {/* Position Type Selector */}
                  <Grid.Col span={12}>
                    <div>
                      <Text size="sm" fw={500} mb="xs">Position Type</Text>
                      <SegmentedControl
                        data={[
                          { label: 'Long', value: 'long' },
                          { label: 'Short', value: 'short' }
                        ]}
                        value={form.values.positionType}
                        onChange={(value) => form.setFieldValue('positionType', value)}
                      />
                    </div>
                  </Grid.Col>

                  {/* Dynamic fields based on position type */}
                  {form.values.positionType === 'short' ? (
                    // Short position: Sell first, then buy
                    <>
                      <Grid.Col span={6}>
                        <NumberInput
                          label="Sell Price (Entry)"
                          placeholder="0.00"
                          min={0}
                          decimalScale={2}
                          prefix="$"
                          {...form.getInputProps('sellPrice')}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <NumberInput
                          label="Buy Price (Exit)"
                          placeholder="0.00"
                          min={0}
                          decimalScale={2}
                          prefix="$"
                          {...form.getInputProps('buyPrice')}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Sell Date (Entry)"
                          type="date"
                          {...form.getInputProps('sellDate')}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Buy Date (Exit)"
                          type="date"
                          {...form.getInputProps('buyDate')}
                        />
                      </Grid.Col>
                    </>
                  ) : (
                    // Long position: Buy first, then sell
                    <>
                      <Grid.Col span={6}>
                        <NumberInput
                          label="Buy Price (Entry)"
                          placeholder="0.00"
                          min={0}
                          decimalScale={2}
                          prefix="$"
                          {...form.getInputProps('buyPrice')}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <NumberInput
                          label="Sell Price (Exit)"
                          placeholder="0.00"
                          min={0}
                          decimalScale={2}
                          prefix="$"
                          {...form.getInputProps('sellPrice')}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Buy Date (Entry)"
                          type="date"
                          {...form.getInputProps('buyDate')}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Sell Date (Exit)"
                          type="date"
                          {...form.getInputProps('sellDate')}
                        />
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
              
              <Group justify="space-between" mt="md">
                {editingTrade ? (
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => confirmDelete(editingTrade.id, handleClose)}
                  >
                    Delete Trade
                  </Button>
                ) : <span />}
                <Group>
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="gradient" gradient={{ from: 'blue', to: 'purple' }}>
                    {editingTrade ? 'Update Trade' : 'Add Trade'}
                  </Button>
                </Group>
              </Group>
            </Stack>
          </form>
        </Modal>

        {/* Delete confirmation modal */}
        <Modal
          opened={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          title="Delete Trade"
          size="sm"
          centered
        >
          <Stack gap="md">
            <Text>Are you sure you want to delete this trade? This action cannot be undone.</Text>
            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
                Delete
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  )
}

export default TradingNotes