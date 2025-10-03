import { useState, useEffect, useMemo } from 'react'
import { 
  Container, 
  Paper, 
  Button, 
  Title, 
  Text, 
  Group, 
  Stack,
  Card,
  Center,
  ThemeIcon,
  Skeleton,
  SegmentedControl,
  Alert,
  Badge,
  Divider,
  ScrollArea,
  Modal,
  Table,
  ActionIcon,
  Tooltip
} from '@mantine/core'
import { 
  IconBrain, 
  IconTrendingUp, 
  IconTrendingDown, 
  IconCurrencyDollar,
  IconPercentage,
  IconInfoCircle,
  IconRefresh,
  IconChartBar,
  IconShield,
  IconTrash
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import apiClient from '../api'
import { checkAdminAccess } from '../utils/admin'

const AIAnalysis = ({ user }) => {
  const [trades, setTrades] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tradesLoading, setTradesLoading] = useState(true)
  const [costData, setCostData] = useState(null)
  const [costModalOpened, setCostModalOpened] = useState(false)
  const [analysisHistory, setAnalysisHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyModalOpened, setHistoryModalOpened] = useState(false)

  useEffect(() => {
    loadTrades()
    loadCostData()
    loadAnalysisHistory()
  }, [])

  // Memoize admin access check to prevent unnecessary re-renders
  const hasAdminAccess = useMemo(() => {
    return checkAdminAccess(user)
  }, [user?.username])

  // Check if user has admin access
  if (!hasAdminAccess) {
    return (
      <Container size="xl" py="xl">
        <Card withBorder>
          <Center py="xl">
            <Stack align="center" gap="md">
              <ThemeIcon size="xl" variant="light" color="red">
                <IconShield size={32} />
              </ThemeIcon>
              <div style={{ textAlign: 'center' }}>
                <Text size="lg" fw={500} mb="xs">
                  Access Denied
                </Text>
                <Text c="dimmed">
                  AI Analysis feature is only available to administrators.
                </Text>
              </div>
            </Stack>
          </Center>
        </Card>
      </Container>
    )
  }

  const loadTrades = async () => {
    try {
      setTradesLoading(true)
      const tradesData = await apiClient.getTrades()
      setTrades(tradesData)
    } catch (error) {
      console.error('Error loading trades:', error)
      notifications.show({
        title: 'Error',
        message: 'Failed to load trades',
        color: 'red',
      })
    } finally {
      setTradesLoading(false)
    }
  }

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
    if (!trades || trades.length === 0) {
      notifications.show({
        title: 'No Data',
        message: 'No trades available for analysis',
        color: 'yellow',
      })
      return
    }

    try {
      setLoading(true)
      const result = await apiClient.analyzeTrades(trades, 'general')
      // Add analysis type to the result for display
      result.analysisType = 'general'
      setAnalysis(result)
      
      // Refresh analysis history
      await loadAnalysisHistory()
      
      notifications.show({
        title: 'Analysis Complete',
        message: `Analysis completed successfully. Cost: $${result.cost.estimatedCost.toFixed(4)}`,
        color: 'green',
      })
    } catch (error) {
      console.error('Error analyzing trades:', error)
      
      // Check if it's a 404 error (API not deployed)
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        notifications.show({
          title: 'AI Analysis Not Available',
          message: 'AI analysis feature needs to be deployed to Vercel. Please deploy the app to use this feature.',
          color: 'orange',
        })
      } else {
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
              leftSection={<IconBrain size={16} />}
              onClick={handleAnalyze}
              loading={loading}
              disabled={!trades || trades.length === 0}
              variant="gradient"
              gradient={{ from: 'purple', to: 'pink' }}
            >
              Analyze Trades
            </Button>
          </Group>
        </Group>

        {/* Analysis Type Selection */}
        <Card withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Analysis Type</Text>
              <Badge 
                color="green"
                leftSection={<IconChartBar size={16} />}
              >
                General Analysis
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              AI-powered analysis of your trading performance with actionable insights and recommendations.
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
                  <Title order={3}>Performance Summary</Title>
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
