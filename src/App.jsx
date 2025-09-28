import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import TradingNotes from './components/TradingNotes'
import Statistics from './components/Statistics'
import Navbar from './components/Navbar'
import apiClient from './api'

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
    <Router>
      <div className="App">
        {isAuthenticated ? (
          <>
            <Navbar user={user} onLogout={handleLogout} />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trades" element={<TradingNotes />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </>
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </div>
    </Router>
  )
}

export default App