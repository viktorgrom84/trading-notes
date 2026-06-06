import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import apiClient from '../api'

const TradesContext = createContext(null)

/**
 * Provides a single shared trades list to all authenticated routes.
 * Eliminates the duplicate getTrades() calls in Dashboard, TradingNotes,
 * Calendar, Statistics, and AIAnalysis.
 *
 * Usage:
 *   const { trades, loading, refresh } = useTrades()
 *
 * Call refresh() after any create / update / delete to sync all consumers.
 */
export function TradesProvider({ children }) {
  const [trades, setTrades]   = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.getTrades()
      setTrades(data)
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') console.error('Error loading trades:', error)
      notifications.show({ title: 'Error', message: 'Failed to load trades', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <TradesContext.Provider value={{ trades, loading, refresh }}>
      {children}
    </TradesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTrades() {
  const ctx = useContext(TradesContext)
  if (!ctx) throw new Error('useTrades must be used inside <TradesProvider>')
  return ctx
}
