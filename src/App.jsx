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
import Navbar from './components/Navbar'
import apiClient from './api'

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, system-ui, sans-serif',
  defaultRadius: 'md',
})

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check if user is logged in (from localStorage)
    const savedUser = localStorage.getItem('tradingUser')
    const token = localStorage.getItem('authToken')
    
    if (savedUser && token) {
      setUser(JSON.parse(savedUser))
      setIsAuthenticated(true)
    }
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
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/trades" element={<TradingNotes />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
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