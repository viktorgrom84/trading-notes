import { useState, useEffect, useCallback } from 'react'
import {
  Container,
  Title,
  Text,
  Stack,
  Card,
  Button,
  Group,
  Tabs,
  CopyButton,
  ActionIcon,
  Tooltip,
  Badge,
  Textarea,
  Skeleton,
  Paper,
} from '@mantine/core'
import {
  IconCopy,
  IconCheck,
  IconChartCandle,
  IconTrendingUp,
  IconTrendingDown,
  IconEdit,
  IconX,
  IconDeviceFloppy,
  IconRefresh,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import apiClient from '../api'

const DEFAULT_SHORT_PROMPTS = [
  {
    id: 'short-pre-market',
    timeLabel: 'Pre-market',
    title: 'Prompt 1 — Morning short scan',
    content: `Scan my watchlist. Find short candidates where ALL of the following are true today:

Universe filter: price > $5, market cap > $500M, average daily volume > 1M shares (skip anything illiquid or microcap).

Price is down 2-7% pre-market on above-average volume (real selling pressure).
Stock gapped up 10%+ in the last 1-5 days and is now showing first signs of reversal (gap fade setup).
OR stock is below both the 50-day and 200-day MA with both MAs sloping downward.

Rank by selling pressure strength. Return a table with:
ticker | pre-market % change | volume ratio | gap age (if applicable) | position vs 50/200-day MA | one-line short thesis

Flag the strongest setup as PRIORITY.`,
  },
  {
    id: 'short-10am',
    timeLabel: '10:00 AM',
    title: 'Prompt 2 — Gap fade confirmation',
    content: `It is 30 minutes after market open. Scan my watchlist for gap fade short setups.

Universe filter: price > $5, market cap > $500M, average daily volume > 1M shares.

A valid setup requires ALL of these:
Stock gapped up 5%+ at open.
Price made its high in the first 30 minutes and is now trading below it.
Volume was extreme at open but is now declining (buyers exhausted).
Price has broken below VWAP – this is the key confirmation signal.
RSI on the 5-minute chart has crossed below 60 after opening above 70.

Exclude any stock with a genuine catalyst (major earnings beat, FDA approval, acquisition).

Rank by strength of VWAP break and volume exhaustion. Return:
ticker | gap % at open | current price vs VWAP | distance below morning high | volume exhaustion signal | 5-min RSI | catalyst type if any | confidence: HIGH / MEDIUM / LOW`,
  },
  {
    id: 'short-before-entry',
    timeLabel: 'Before every entry',
    title: 'Prompt 3 — Squeeze risk check',
    content: `Before I short [TICKER], run a full squeeze risk assessment.

Check the following data points. If any one is unavailable from your data source, mark it UNKNOWN and lower confidence accordingly — DO NOT estimate or fabricate values:

Short interest as % of float (above 20% = dangerous, above 30% = extreme risk).
Days to cover (above 5 = high risk).
Unusual call options activity suggesting someone is positioning long.
Recent institutional buying (large fund taking a new position).
Stock borrow rate / borrow availability (high rate = crowded and expensive to hold).
Upcoming catalysts in the next 14 days (earnings, FDA, product launch, investor day).

Return a SQUEEZE RISK SCORE from 1-10 (1 = safe, 10 = extremely dangerous), with a list of which data points were available vs UNKNOWN.
End with a clear recommendation: GO / CAUTION / AVOID and the specific reason why.`,
  },
  {
    id: 'short-3-30pm',
    timeLabel: '3:30 PM',
    title: 'Prompt 4 — End of day review',
    content: `Market closes in 30 minutes. Review my watchlist and do the following:

1. Identify which of today's short candidates dropped more than 3% on strong volume – these are confirmed weak names, add to tomorrow's watchlist.
2. Find stocks closing at or within 1% of their 52-week low on above-average volume – maximum weakness, potential gap down tomorrow.
3. Find stocks that bounced today but failed and are now closing near the day's low – failed recovery, more downside likely.
4. Flag any watchlist stock that went UP more than 3% on high volume today – unexpected strength, remove from short watchlist immediately.

Return four lists:
CONTINUATION SHORTS | BREAKDOWN WATCH | FAILED BOUNCE SHORTS | REMOVE FROM WATCHLIST

For each ticker include the key price level to watch tomorrow and what confirms or invalidates the setup.`,
  },
]

const DEFAULT_LONG_PROMPTS = [
  {
    id: 'long-pre-market',
    timeLabel: 'Pre-market',
    title: 'L1 — Morning long scan',
    content: `Scan my watchlist. Find long candidates where ALL of the following are true today:

Universe filter: price > $5, market cap > $500M, average daily volume > 1M shares (skip anything illiquid or microcap).

Price is up 2-8% pre-market on above-average volume (strong but not parabolic – anything above 10% pre-market is likely a trap).
Stock is above both the 50-day and 200-day MA (confirmed uptrend only).
Price is within 5% of a 52-week high or breaking above it.

Rank by pre-market volume strength. Return a table with:
ticker | pre-market % change | volume ratio | distance from 52-week high | position vs 50/200-day MA | one-line long thesis

Flag the strongest setup as PRIORITY.`,
  },
  {
    id: 'long-10am',
    timeLabel: '10:00 AM',
    title: 'L2 — Breakout confirmation',
    content: `It is 30 minutes after market open. Scan my watchlist for confirmed breakout long setups.

Universe filter: price > $5, market cap > $500M, average daily volume > 1M shares.

A valid setup requires ALL of these:
Price has broken above the previous 20-day high today.
Relative volume (RVOL) on the first 30-minute bar is at least 3x its 20-day average for that same time slot.
Price is holding above the breakout level and not immediately reversing (no full retrace back below the level).
RSI on the daily is between 55 and 72 (strong momentum, not yet overbought).

Exclude any stock that gapped up more than 8% at open – too extended for a safe entry.

Rank by volume conviction. Return:
ticker | breakout level | current price | % above breakout | 30-min RVOL | daily RSI | confidence: HIGH / MEDIUM / LOW`,
  },
  {
    id: 'long-after-10am',
    timeLabel: 'After 10 AM',
    title: 'L3 — First pullback entry',
    content: `Scan my watchlist for first pullback long entries – stocks that broke out earlier today and are now offering a lower-risk re-entry.

Universe filter: price > $5, market cap > $500M, average daily volume > 1M shares.

A valid setup requires ALL of these:
Price broke above a key level (previous high, VWAP, or ORB level) earlier today.
Price has since pulled back and retraced between 38% and 61% of the breakout move (Fibonacci zone) – not a deeper drop.
Price is holding above the 9-EMA on the 5-minute chart.
Pullback is happening on declining volume (weak sellers, not panic).
Price is still above VWAP.
RSI on the 5-minute chart has cooled to between 45 and 60 during the pullback.
Risk/reward to the next resistance is at least 2:1 from the proposed entry.

Rank by quality of the retest and proximity to support. Return:
ticker | breakout level | current price | retracement % of breakout move | distance from 9-EMA | 5-min RSI | R:R to next resistance | confidence: HIGH / MEDIUM / LOW`,
  },
  {
    id: 'long-3-30pm',
    timeLabel: '3:30 PM',
    title: 'L4 — End of day long review',
    content: `Market closes in 30 minutes. Review my watchlist and do the following:

1. Identify which of today's long candidates gained more than 3% on strong volume – confirmed momentum names, watch for continuation tomorrow.
2. Find stocks closing at or within 0.5% of their 52-week high on above-average volume – potential breakout tomorrow on any positive catalyst.
3. Find stocks that gapped up today but pulled back and are closing near the day's low on high volume – showed distribution, avoid tomorrow.
4. Flag any watchlist stock that dropped more than 3% on high volume today – unexpected weakness, remove from long watchlist immediately.

Return four lists:
CONTINUATION LONGS | BREAKOUT WATCH | AVOID TOMORROW | REMOVE FROM WATCHLIST

For each ticker include the key price level to watch tomorrow and what confirms or invalidates the setup.`,
  },
  {
    id: 'long-after-market',
    timeLabel: 'After market',
    title: 'L5 — After-hours scan & tomorrow prep',
    content: `The market closed earlier today. Run a full after-hours analysis to build my watchlist and game plan for tomorrow's open.

Universe filter: price > $5, market cap > $500M, average daily volume > 1M shares.

STEP 1 — After-hours gap-up movers (long candidates):
Find stocks currently up more than 5% in extended hours on heavy AH volume (at least 500K shares traded post-close).
For each, classify the catalyst as STRONG / MIXED / WEAK:
- STRONG = full beat-and-raise earnings (revenue + EPS + raised guidance), unambiguous positive news (FDA approval, accretive M&A, major contract win), no offsetting bad news.
- MIXED = partial beat (EPS beat but revenue miss, beat but lowered guidance, FDA win on small indication, in-line with whisper).
- WEAK = beat that was already priced in, vague good news, or news that historically fades by next open.
Return: ticker | AH % move | AH volume | catalyst type | catalyst quality | sector

STEP 2 — Closing-strength continuation candidates:
Find stocks that closed in the top 10% of their daily range AND are still holding firm in extended hours (no significant fade post-close). These are follow-through candidates regardless of fresh catalyst.
Return: ticker | close vs day's range | AH price change | distance from 52-week high | sector

STEP 3 — Tomorrow's pre-market game plan:
For every candidate from Steps 1 and 2, identify:
- The exact price level that would CONFIRM continuation tomorrow at open (typically AH high, or today's close + 1%).
- The exact price level that would INVALIDATE the long thesis (typically below today's close, or below VWAP at open).
- Whether the stock has scheduled earnings or major catalysts within the next 5 days that could disrupt holding it.

STEP 4 — Pre-open catalyst calendar:
List any scheduled events that could move my watchlist tomorrow before 9:30 AM ET:
- Pre-market earnings reports from companies on my watchlist or in the same sectors.
- Economic data releases (CPI, PPI, NFP, FOMC decisions, GDP, retail sales, jobless claims).
- Fed speakers scheduled before the open.

OUTPUT — Return three ranked lists:
TOMORROW PRIORITY LONGS — top 3-5 highest-conviction names with the specific entry-confirmation level.
TOMORROW WATCH — next 5-10 secondary names worth monitoring.
AVOID — stocks that look strong post-close but have red flags (WEAK catalyst, sector breakdown, or scheduled risk event tomorrow that could wipe the move).

End with a one-line market context note: are SPY and QQQ closing strong, weak, or neutral today, and what does that imply about risk-on conviction tomorrow?`,
  },
]

const SETTINGS_KEY_SHORT = 'mcp_prompts_short'
const SETTINGS_KEY_LONG = 'mcp_prompts_long'

const PromptCard = ({ prompt, side, onSave, onReset, defaultContent }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(prompt.content)
  const [saving, setSaving] = useState(false)
  const accentColor = side === 'long' ? 'green' : 'red'
  const isModified = prompt.content !== defaultContent

  const handleEdit = () => {
    setDraft(prompt.content)
    setEditing(true)
  }

  const handleCancel = () => {
    setDraft(prompt.content)
    setEditing(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(prompt.id, draft)
    setSaving(false)
    setEditing(false)
  }

  const handleReset = async () => {
    setSaving(true)
    await onReset(prompt.id)
    setSaving(false)
    setEditing(false)
  }

  return (
    <Card withBorder radius="md" p="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs" align="center">
            <Text fw={600} size="lg">{prompt.title}</Text>
            {isModified && (
              <Badge size="xs" color="blue" variant="dot">customized</Badge>
            )}
          </Group>
          <Group gap="xs">
            {!editing && (
              <>
                <Tooltip label="Edit prompt" withArrow position="left">
                  <ActionIcon variant="subtle" color="blue" onClick={handleEdit} size="lg">
                    <IconEdit size={18} />
                  </ActionIcon>
                </Tooltip>
                {isModified && (
                  <Tooltip label="Reset to default" withArrow position="left">
                    <ActionIcon variant="subtle" color="orange" onClick={handleReset} size="lg" loading={saving}>
                      <IconRefresh size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <CopyButton value={prompt.content} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied!' : 'Copy'} withArrow position="left">
                      <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy} size="lg">
                        {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </>
            )}
          </Group>
        </Group>

        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            autosize
            minRows={8}
            styles={{
              input: {
                fontFamily: 'inherit',
                fontSize: '14px',
                lineHeight: 1.7,
              },
            }}
          />
        ) : (
          <Text
            size="sm"
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.7,
              color: 'var(--mantine-color-dark-6)',
            }}
          >
            {prompt.content}
          </Text>
        )}

        <Group gap="xs">
          {editing ? (
            <>
              <Button
                size="xs"
                leftSection={<IconDeviceFloppy size={14} />}
                color={accentColor}
                onClick={handleSave}
                loading={saving}
              >
                Save
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconX size={14} />}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              {isModified && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="orange"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleReset}
                  loading={saving}
                >
                  Reset to default
                </Button>
              )}
            </>
          ) : (
            <CopyButton value={prompt.content} timeout={2000}>
              {({ copied, copy }) => (
                <Button
                  variant="outline"
                  size="xs"
                  leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  color={copied ? 'teal' : accentColor}
                  onClick={copy}
                  w="fit-content"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          )}
        </Group>
      </Stack>
    </Card>
  )
}

const TradingViewMCP = () => {
  const [side, setSide] = useState('short')
  const [shortTab, setShortTab] = useState('short-pre-market')
  const [longTab, setLongTab] = useState('long-pre-market')
  const [shortPrompts, setShortPrompts] = useState(DEFAULT_SHORT_PROMPTS)
  const [longPrompts, setLongPrompts] = useState(DEFAULT_LONG_PROMPTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await apiClient.getSettings()

        if (settings[SETTINGS_KEY_SHORT]) {
          const saved = JSON.parse(settings[SETTINGS_KEY_SHORT])
          setShortPrompts(
            DEFAULT_SHORT_PROMPTS.map((def) => ({
              ...def,
              content: saved[def.id] ?? def.content,
            }))
          )
        }

        if (settings[SETTINGS_KEY_LONG]) {
          const saved = JSON.parse(settings[SETTINGS_KEY_LONG])
          setLongPrompts(
            DEFAULT_LONG_PROMPTS.map((def) => ({
              ...def,
              content: saved[def.id] ?? def.content,
            }))
          )
        }
      } catch {
        // silently fall back to defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const savePrompts = useCallback(async (updatedPrompts, settingsKey) => {
    const map = Object.fromEntries(updatedPrompts.map((p) => [p.id, p.content]))
    await apiClient.setSetting(settingsKey, JSON.stringify(map))
  }, [])

  const handleSave = useCallback(async (promptId, newContent) => {
    const isSide = (id) => id.startsWith('short-') ? 'short' : 'long'
    const targetSide = isSide(promptId)

    if (targetSide === 'short') {
      const updated = shortPrompts.map((p) =>
        p.id === promptId ? { ...p, content: newContent } : p
      )
      setShortPrompts(updated)
      await savePrompts(updated, SETTINGS_KEY_SHORT)
    } else {
      const updated = longPrompts.map((p) =>
        p.id === promptId ? { ...p, content: newContent } : p
      )
      setLongPrompts(updated)
      await savePrompts(updated, SETTINGS_KEY_LONG)
    }

    notifications.show({
      title: 'Saved',
      message: 'Prompt updated successfully',
      color: 'green',
    })
  }, [shortPrompts, longPrompts, savePrompts])

  const handleReset = useCallback(async (promptId) => {
    const isSide = (id) => id.startsWith('short-') ? 'short' : 'long'
    const targetSide = isSide(promptId)
    const defaults = targetSide === 'short' ? DEFAULT_SHORT_PROMPTS : DEFAULT_LONG_PROMPTS
    const defaultPrompt = defaults.find((p) => p.id === promptId)

    if (targetSide === 'short') {
      const updated = shortPrompts.map((p) =>
        p.id === promptId ? { ...p, content: defaultPrompt.content } : p
      )
      setShortPrompts(updated)
      await savePrompts(updated, SETTINGS_KEY_SHORT)
    } else {
      const updated = longPrompts.map((p) =>
        p.id === promptId ? { ...p, content: defaultPrompt.content } : p
      )
      setLongPrompts(updated)
      await savePrompts(updated, SETTINGS_KEY_LONG)
    }

    notifications.show({
      title: 'Reset',
      message: 'Prompt restored to default',
      color: 'orange',
    })
  }, [shortPrompts, longPrompts, savePrompts])

  const prompts = side === 'short' ? shortPrompts : longPrompts
  const defaults = side === 'short' ? DEFAULT_SHORT_PROMPTS : DEFAULT_LONG_PROMPTS
  const activeTab = side === 'short' ? shortTab : longTab
  const setActiveTab = side === 'short' ? setShortTab : setLongTab

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <div>
          <Group gap="sm" mb="xs">
            <IconChartCandle size={28} />
            <Title order={1}>TradingView MCP</Title>
          </Group>
          <Text c="dimmed" size="lg">
            Ready-to-use prompts for each stage of your trading day — edit to personalise
          </Text>
        </div>

        <Paper withBorder radius="xl" p={4} style={{ display: 'inline-flex', width: 'fit-content' }}>
          <Group gap={0}>
            <Button
              variant={side === 'short' ? 'filled' : 'subtle'}
              color="red"
              radius="xl"
              size="sm"
              leftSection={<IconTrendingDown size={16} />}
              onClick={() => setSide('short')}
              styles={{
                root: {
                  fontWeight: 600,
                  transition: 'all 0.2s',
                },
              }}
            >
              Short side
            </Button>
            <Button
              variant={side === 'long' ? 'filled' : 'subtle'}
              color="green"
              radius="xl"
              size="sm"
              leftSection={<IconTrendingUp size={16} />}
              onClick={() => setSide('long')}
              styles={{
                root: {
                  fontWeight: 600,
                  transition: 'all 0.2s',
                },
              }}
            >
              Long side
            </Button>
          </Group>
        </Paper>

        {loading ? (
          <Stack gap="md">
            <Skeleton height={40} />
            <Skeleton height={300} />
          </Stack>
        ) : (
          <Tabs
            key={side}
            value={activeTab}
            onChange={setActiveTab}
            variant="outline"
            color={side === 'long' ? 'green' : 'red'}
          >
            <Tabs.List>
              {prompts.map((p) => (
                <Tabs.Tab key={p.id} value={p.id}>
                  <Text size="sm" fw={500}>{p.timeLabel}</Text>
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {prompts.map((p) => {
              const def = defaults.find((d) => d.id === p.id)
              return (
                <Tabs.Panel key={p.id} value={p.id} pt="xl">
                  <PromptCard
                    prompt={p}
                    side={side}
                    onSave={handleSave}
                    onReset={handleReset}
                    defaultContent={def.content}
                  />
                </Tabs.Panel>
              )
            })}
          </Tabs>
        )}
      </Stack>
    </Container>
  )
}

export default TradingViewMCP
