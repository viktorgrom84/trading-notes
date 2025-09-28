import { Link, useLocation } from 'react-router-dom'
import { BarChart3, BookOpen, Home, LogOut, TrendingUp, Menu, X } from 'lucide-react'
import { useState } from 'react'

const Navbar = ({ user, onLogout }) => {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/trades', label: 'Trading Notes', icon: BookOpen },
    { path: '/statistics', label: 'Statistics', icon: BarChart3 }
  ]

  return (
    <nav className="bg-white shadow-soft border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-600 rounded-xl shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">TradingNotes</span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
          
          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700">
                {user?.username}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="btn btn-outline btn-sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-4">
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
              
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-3 px-4 py-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {user?.username}
                  </span>
                </div>
                <button
                  onClick={() => {
                    onLogout()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar