import { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Container, 
  Button, 
  Title, 
  Text, 
  Group, 
  Stack,
  Card,
  Center,
  ThemeIcon,
  Skeleton,
  Alert,
  Badge,
  ScrollArea,
  Modal,
  Table,
  ActionIcon,
  Tooltip,
  Select,
  Paper
} from '@mantine/core'
import { 
  IconBrain, 
  IconTrendingUp, 
  IconTrendingDown,
  IconPercentage,
  IconInfoCircle,
  IconRefresh,
  IconChartBar,
  IconTrash,
  IconClock
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import apiClient from '../api'
import { checkAdminAccess } from '../utils/admin'
import { useTrades } from '../context/TradesContext'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const AIAnalysis = ({ user }) => {
  const { trades, loading: tradesLoading } = useTrades()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [costData, setCostData] = useState(null)
  const [costModalOpened, setCostModalOpened] = useState(false)
  const [analysisHistory, setAnalysisHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyModalOpened, setHistoryModalOpened] = useState(false)
  const [tradesToAnalyze, setTradesToAnalyze] = useState('all')
  const [lastAnalysisDate, setLastAnalysisDate] = useState(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    loadCostData()
    loadAnalysisHistory()
    loadLastAnalysisDate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadLastAnalysisDate = useCallback(async () => {
    try {
      const settings = await apiClient.getSettings()
      if (settings.aiAnalysisLastUsed) {
        setLastAnalysisDate(new Date(settings.aiAnalysisLastUsed))
      }
    } catch {
      const saved = localStorage.getItem('aiAnalysisLastUsed')
      if (saved) setLastAnalysisDate(new Date(saved))
    } finally {
      setSettingsLoaded(true)
    }
  }, [])

  const isAdmin = useMemo(() => checkAdminAccess(user), [user])

  const nextAvailableDate = useMemo(() => {
    if (!lastAnalysisDate) return null
    return new Date(lastAnalysisDate.getTime() + WEEK_MS)
  }, [lastAnalysisDate])

  const canAnalyze = useMemo(() => {
    if (isAdmin) return true
    if (!lastAnalysisDate) return true
    return Date.now() - lastAnalysisDate.getTime() >= WEEK_MS
  }, [isAdmin, lastAnalysisDate])

  const timeUntilNext = useMemo(() => {
    if (!nextAvailableDate || canAnalyze) return ''
    const ms = nextAvailableDate.getTime() - Date.now()
    const days = Math.floor(ms / (24 * 60 * 60 * 1000))
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60000)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }, [nextAvailableDate, canAnalyze])

  // Get filtered trades based on selection
  const getFilteredTrades = useMemo(() => {
    if (tradesToAnalyze === 'all') return trades
    const count = parseInt(tradesToAnalyze)
    const sortedTrades = [...trades].sort((a, b) => new Date(b.buy_date) - new Date(a.buy_date))
    return sortedTrades.slice(0, count)
  }, [trades, tradesToAnalyze])

  const loadCostData = async () => {
    try {
      const data = await apiClient.getCostData()
      setCostData(data)
    } catch (error) {
      console.error('Error loading cost data:', error)
      // Set fallback data if API fails
      setCostData({
        currentMonth: {
          totalAnalyses: 0,
          totalCost: 0.00,
          averageCostPerAnalysis: 0.00
        },
        recommendations: {
          usageLimits: {
            daily: 5,
            monthly: 50,
            costLimit: 10.00
          },
          costOptimization: [
            'Use shorter prompts for simple analyses',
            'Batch multiple trade analyses together',
            'Set up usage alerts in OpenAI dashboard',
            'GPT-4 Turbo provides high-quality insights with better performance'
          ]
        },
        openaiDashboard: {
          url: 'https://platform.openai.com/usage',
          instructions: [
            'Set usage limits in OpenAI dashboard',
            'Monitor daily and monthly costs',
            'Set up billing alerts',
            'Review token usage patterns'
          ]
        }
      })
    }
  }

  const loadAnalysisHistory = async () => {
    try {
      setHistoryLoading(true)
      const data = await apiClient.getAnalysisHistory()
      setAnalysisHistory(data.analysisHistory || [])
    } catch (error) {
      console.error('Error loading analysis history:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to load analysis history',
        color: 'red',
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDeleteAnalysis = async (analysisId) => {
    try {
      await apiClient.deleteAnalysis(analysisId)
      
      // Remove from local state
      setAnalysisHistory(prev => prev.filter(item => item.id !== analysisId))
      
      // If the deleted analysis is currently displayed, clear it
      if (analysis && analysis.id === analysisId) {
        setAnalysis(null)
      }
      
      notifications.show({
        title: 'Success',
        message: 'Analysis deleted successfully',
        color: 'green',
      })
    } catch (error) {
      console.error('Error deleting analysis:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to delete analysis',
        color: 'red',
      })
    }
  }

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      notifications.show({
        title: 'Weekly Limit Reached',
        message: `Your next analysis is available in ${timeUntilNext}.`,
        color: 'orange',
      })
      return
    }

    const filteredTrades = getFilteredTrades
    
    if (!filteredTrades || filteredTrades.length === 0) {
      notifications.show({
        title: 'No Data',
        message: 'No trades available for analysis',
        color: 'yellow',
      })
      return
    }

    try {
      setLoading(true)
      const result = await apiClient.analyzeTrades(filteredTrades, 'general')
      result.analysisType = 'general'
      result.tradeCount = filteredTrades.length
      result.totalTrades = trades.length
      setAnalysis(result)

      // Save last used timestamp
      const now = new Date()
      try {
        await apiClient.setSetting('aiAnalysisLastUsed', now.toISOString())
      } catch {
        // fall through to localStorage
      }
      localStorage.setItem('aiAnalysisLastUsed', now.toISOString())
      setLastAnalysisDate(now)
      
      await loadAnalysisHistory()
      
      const tradeText = tradesToAnalyze === 'all' ? 'all trades' : `last ${filteredTrades.length} trades`
      notifications.show({
        title: 'Analysis Complete',
        message: `Analysis of ${tradeText} completed successfully. Cost: $${result.cost.estimatedCost.toFixed(4)}`,
        color: 'green',
      })
    } catch (error) {
      console.error('Error analyzing trades:', error)

      if (error.message.includes('429') || error.message.toLowerCase().includes('weekly limit')) {
        // Server rejected — sync the local state so the UI reflects reality
        await loadLastAnalysisDate()
        notifications.show({
          title: 'Weekly Limit Reached',
          message: 'You have already used your analysis this week.',
          color: 'orange',
        })
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        notifications.show({
          title: 'AI Analysis Not Available',
          message: 'AI analysis feature needs to be deployed to Vercel.',
          color: 'orange',
        })
      } else {
        // If OpenAI failed after we stamped the timestamp, roll it back locally
        // (the server already recorded it — user can contact admin)
        notifications.show({
          title: 'Analysis Failed',
          message: 'Failed to analyze trades. Please try again.',
          color: 'red',
        })
      }
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


  if (tradesLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <Skeleton height={32} width={300} />
          <Skeleton height={200} />
        </Stack>
      </Container>
    )
  }

  if (!trades || trades.length === 0) {
    return (
      <Container size="xl" py="xl">
        <Card withBorder>
          <Center py="xl">
            <Stack align="center" gap="md">
              <ThemeIcon size="xl" variant="light" color="gray">
                <IconBrain size={32} />
              </ThemeIcon>
              <div style={{ textAlign: 'center' }}>
                <Text size="lg" fw={500} mb="xs">
                  No Trades Available
                </Text>
                <Text c="dimmed">
                  Add some trades to get AI-powered analysis
                </Text>
              </div>
            </Stack>
          </Center>
        </Card>
      </Container>
    )
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1} mb="sm">AI Trading Analysis</Title>
            <Text c="dimmed" size="lg">Get AI-powered insights on your trading performance</Text>
          </div>
          <Group gap="sm">
            <Button
              variant="outline"
              leftSection={<IconChartBar size={16} />}
              onClick={() => setHistoryModalOpened(true)}
            >
              History ({analysisHistory.length})
            </Button>
            <Button
              variant="outline"
              leftSection={<IconInfoCircle size={16} />}
              onClick={() => setCostModalOpened(true)}
            >
              Cost Info
            </Button>
            <Button
              leftSection={canAnalyze ? <IconBrain size={16} /> : <IconClock size={16} />}
              onClick={handleAnalyze}
              loading={loading}
              disabled={!trades || trades.length === 0 || !canAnalyze || !settingsLoaded}
              variant="gradient"
              gradient={canAnalyze ? { from: 'purple', to: 'pink' } : { from: 'gray', to: 'gray' }}
            >
              {!canAnalyze
                ? `Available in ${timeUntilNext}`
                : tradesToAnalyze === 'all'
                  ? `Analyze All Trades (${trades.length})`
                  : `Analyze Last ${Math.min(parseInt(tradesToAnalyze), trades.length)} Trades`
              }
            </Button>
          </Group>
        </Group>

        {/* Weekly limit banner — hidden for admin */}
        {settingsLoaded && !canAnalyze && !isAdmin && (
          <Alert icon={<IconClock size={16} />} color="orange" title="Weekly limit reached">
            You've used your AI analysis for this week. Your next analysis will be available on{' '}
            <strong>{nextAvailableDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
            {' '}({timeUntilNext} from now). You can still view your previous analyses in History.
          </Alert>
        )}

        {/* Analysis Type Selection */}
        <Card withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Analysis Configuration</Text>
              <Badge 
                color="green"
                leftSection={<IconChartBar size={16} />}
              >
                General Analysis
              </Badge>
            </Group>
            
            <Group grow>
              <div>
                <Text size="sm" fw={500} mb="xs">Number of Trades to Analyze</Text>
                <Select
                  value={tradesToAnalyze}
                  onChange={setTradesToAnalyze}
                  data={[
                    { value: '5', label: 'Last 5 trades' },
                    { value: '10', label: 'Last 10 trades' },
                    { value: '15', label: 'Last 15 trades' },
                    { value: '20', label: 'Last 20 trades' },
                    { value: 'all', label: 'All trades' }
                  ]}
                  placeholder="Select trades to analyze"
                />
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Available Trades</Text>
                <Text size="lg" fw={700} c="blue">
                  {trades.length} total trades
                </Text>
                {tradesToAnalyze !== 'all' && (
                  <Text size="sm" c="dimmed">
                    Will analyze last {Math.min(parseInt(tradesToAnalyze), trades.length)} trades
                  </Text>
                )}
              </div>
            </Group>
            
            <Text size="sm" c="dimmed">
              AI-powered analysis of your selected trades with actionable insights and recommendations.
            </Text>
          </Stack>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <Stack gap="md">
            {/* Statistics Summary */}
            <Card withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Title order={3}>Performance Summary</Title>
                    {analysis.tradeCount && analysis.totalTrades && (
                      <Text size="sm" c="dimmed">
                        Analyzing {analysis.tradeCount} of {analysis.totalTrades} total trades
                      </Text>
                    )}
                  </div>
                  <Badge 
                    color="green"
                    leftSection={<IconChartBar size={16} />}
                  >
                    General Analysis
                  </Badge>
                </Group>
                
                <Group grow>
                  <Paper p="md" withBorder>
                    <Group gap="sm" mb="xs">
                      <ThemeIcon size="sm" variant="light" color="blue">
                        <IconChartBar size={16} />
                      </ThemeIcon>
                      <Text size="sm" fw={500}>Total Trades</Text>
                    </Group>
                    <Text size="xl" fw={700}>{analysis.statistics.totalTrades}</Text>
                  </Paper>
                  
                  <Paper p="md" withBorder>
                    <Group gap="sm" mb="xs">
                      <ThemeIcon size="sm" variant="light" color="green">
                        <IconTrendingUp size={16} />
                      </ThemeIcon>
                      <Text size="sm" fw={500}>Closed Trades</Text>
                    </Group>
                    <Text size="xl" fw={700}>{analysis.statistics.closedTrades}</Text>
                  </Paper>
                  
                  <Paper p="md" withBorder>
                    <Group gap="sm" mb="xs">
                      <ThemeIcon 
                        size="sm" 
                        variant="light" 
                        color={analysis.statistics.totalProfit >= 0 ? 'green' : 'red'}
                      >
                        {analysis.statistics.totalProfit >= 0 ? 
                          <IconTrendingUp size={16} /> : 
                          <IconTrendingDown size={16} />
                        }
                      </ThemeIcon>
                      <Text size="sm" fw={500}>Total P/L</Text>
                    </Group>
                    <Text 
                      size="xl" 
                      fw={700} 
                      c={analysis.statistics.totalProfit >= 0 ? 'green' : 'red'}
                    >
                      {formatCurrency(analysis.statistics.totalProfit)}
                    </Text>
                  </Paper>
                  
                  <Paper p="md" withBorder>
                    <Group gap="sm" mb="xs">
                      <ThemeIcon size="sm" variant="light" color={Number(analysis.statistics.winRate) >= 65 ? 'green' : 'red'}>
                        <IconPercentage size={16} />
                      </ThemeIcon>
                      <Text size="sm" fw={500}>Win Rate</Text>
                    </Group>
                    <Text 
                      size="xl" 
                      fw={700} 
                      c={Number(analysis.statistics.winRate) >= 65 ? 'green' : 'red'}
                    >
                      {analysis.statistics.winRate.toFixed(1)}%
                    </Text>
                  </Paper>
                </Group>
              </Stack>
            </Card>

            {/* AI Analysis Text */}
            <Card withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={3}>AI Analysis</Title>
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">
                      Tokens: {analysis.cost.totalTokens} | 
                      Cost: {formatCurrency(analysis.cost.estimatedCost)}
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={handleAnalyze}
                      loading={loading}
                    >
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
                
                <ScrollArea h={400}>
                  <Text style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {analysis.analysis}
                  </Text>
                </ScrollArea>
              </Stack>
            </Card>
          </Stack>
        )}

        {/* Loading State */}
        {loading && (
          <Card withBorder>
            <Stack gap="md">
              <Skeleton height={32} width={200} />
              <Skeleton height={200} />
            </Stack>
          </Card>
        )}

        {/* Analysis History Modal */}
        <Modal
          opened={historyModalOpened}
          onClose={() => setHistoryModalOpened(false)}
          title="Analysis History"
          size="xl"
        >
          <Stack gap="md">
            {historyLoading ? (
              <Stack gap="md">
                <Skeleton height={100} />
                <Skeleton height={100} />
                <Skeleton height={100} />
              </Stack>
            ) : analysisHistory.length === 0 ? (
              <Card withBorder>
                <Center py="xl">
                  <Stack align="center" gap="md">
                    <ThemeIcon size="xl" variant="light" color="gray">
                      <IconChartBar size={32} />
                    </ThemeIcon>
                    <div style={{ textAlign: 'center' }}>
                      <Text size="lg" fw={500} mb="xs">
                        No Analysis History
                      </Text>
                      <Text c="dimmed">
                        Run your first AI analysis to see it here
                      </Text>
                    </div>
                  </Stack>
                </Center>
              </Card>
            ) : (
              <ScrollArea h={500}>
                <Stack gap="md">
                  {analysisHistory.map((item, index) => (
                    <Card key={item.id || index} withBorder p="md">
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Group gap="sm">
                            <Badge 
                              color="green"
                              leftSection={<IconChartBar size={16} />}
                            >
                              General Analysis
                            </Badge>
                            <Text size="sm" c="dimmed">
                              {new Date(item.createdAt).toLocaleString()}
                            </Text>
                          </Group>
                          <Group gap="xs">
                            <Text size="sm" c="dimmed">
                              Cost: {formatCurrency(item.costData?.estimatedCost || 0)}
                            </Text>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setAnalysis({
                                  analysis: item.analysisText,
                                  statistics: item.statistics,
                                  cost: item.costData,
                                  analysisType: item.analysisType
                                })
                                setHistoryModalOpened(false)
                              }}
                            >
                              View
                            </Button>
                            <Tooltip label="Delete analysis">
                              <ActionIcon
                                size="sm"
                                variant="outline"
                                color="red"
                                onClick={() => handleDeleteAnalysis(item.id)}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Group>
                        
                        <Text size="sm" lineClamp={3}>
                          {item.analysisText}
                        </Text>
                        
                        <Group gap="md">
                          <Text size="xs" c="dimmed">
                            Trades: {item.statistics?.totalTrades || 0} | 
                            Win Rate: {item.statistics?.winRate?.toFixed(1) || 0}% | 
                            P/L: {formatCurrency(item.statistics?.totalProfit || 0)}
                          </Text>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Stack>
        </Modal>

        {/* Cost Management Modal */}
        <Modal
          opened={costModalOpened}
          onClose={() => setCostModalOpened(false)}
          title="AI Analysis Cost Management"
          size="lg"
        >
          <Stack gap="md">
            <Alert
              icon={<IconInfoCircle size={16} />}
              title="Cost Information"
              color="blue"
            >
              AI analysis using GPT-3.5-turbo typically costs $0.01-0.03 per analysis. Costs are based on the number of tokens used and provide quality insights at a lower cost.
            </Alert>

            {costData && (
              <>
                <Card withBorder p="md">
                  <Title order={4} mb="md">Current Usage</Title>
                  <Table>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td fw={500}>Analyses This Month</Table.Td>
                        <Table.Td>{costData.currentMonth.totalAnalyses}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td fw={500}>Total Cost</Table.Td>
                        <Table.Td>{formatCurrency(costData.currentMonth.totalCost)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td fw={500}>Average Cost per Analysis</Table.Td>
                        <Table.Td>{formatCurrency(costData.currentMonth.averageCostPerAnalysis)}</Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Card>

                <Card withBorder p="md">
                  <Title order={4} mb="md">Cost Optimization Tips</Title>
                  <Stack gap="xs">
                    {costData.recommendations.costOptimization.map((tip, index) => (
                      <Text key={index} size="sm">• {tip}</Text>
                    ))}
                  </Stack>
                </Card>

                <Card withBorder p="md">
                  <Title order={4} mb="md">OpenAI Dashboard</Title>
                  <Text size="sm" mb="md">
                    Monitor your usage and set limits at:
                  </Text>
                  <Button
                    component="a"
                    href={costData.openaiDashboard.url}
                    target="_blank"
                    variant="outline"
                    leftSection={<IconInfoCircle size={16} />}
                  >
                    Open OpenAI Dashboard
                  </Button>
                </Card>
              </>
            )}
          </Stack>
        </Modal>
      </Stack>
    </Container>
  )
}

export default AIAnalysis
