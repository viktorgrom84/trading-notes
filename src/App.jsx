import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { MantineProvider, createTheme, AppShell } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import TradingNotes from './components/TradingNotes'
import Statistics from './components/Statistics'
import Calendar from './components/Calendar'
import Admin from './components/Admin'
import AIAnalysis from './components/AIAnalysis'
import TradingViewMCP from './components/TradingViewMCP'
import Earnings from './components/Earnings'
import EconomicEvents from './components/EconomicEvents'
import IPOs from './components/IPOs'
import MarketIndicators from './components/MarketIndicators'
import OpenOptions from './components/OpenOptions'
import Navbar from './components/Navbar'
import apiClient from './api'
import { TradesProvider } from './context/TradesContext'

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, system-ui, sans-serif',
  defaultRadius: 'md',
})

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('tradingUser')
    const token = localStorage.getItem('authToken')

    if (savedUser && token && !apiClient.isTokenExpired()) {
      setUser(JSON.parse(savedUser))
      setIsAuthenticated(true)
    } else if (savedUser || token) {
      // Stale or expired session — clear it so the user sees the login screen
      localStorage.removeItem('tradingUser')
      apiClient.clearToken()
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      setIsAuthenticated(false)
      localStorage.removeItem('tradingUser')
      apiClient.clearToken()
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
    localStorage.setItem('tradingUser', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem('tradingUser')
    apiClient.clearToken()
  }

  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <Router>
        {isAuthenticated ? (
          <AppShell
            header={{ height: 60 }}
            padding="md"
          >
            <Navbar user={user} onLogout={handleLogout} />
            <AppShell.Main>
                  <TradesProvider>
                  <Routes>
                    <Route path="/" element={<Dashboard user={user} />} />
                    <Route path="/trades" element={<TradingNotes />} />
                    <Route path="/statistics" element={<Statistics />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/options" element={<OpenOptions />} />
                    <Route path="/ai-analysis" element={<AIAnalysis user={user} />} />
                    <Route path="/tradingview-mcp" element={<TradingViewMCP />} />
                    <Route path="/earnings" element={<Earnings />} />
                    <Route path="/economic-events" element={<EconomicEvents />} />
                    <Route path="/ipos" element={<IPOs />} />
                    <Route path="/market-indicators" element={<MarketIndicators />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                  </TradesProvider>
            </AppShell.Main>
          </AppShell>
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </Router>
    </MantineProvider>
  )
}

export default App