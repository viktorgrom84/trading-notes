import { useState } from 'react'
import { LogIn, UserPlus, TrendingUp, Eye, EyeOff } from 'lucide-react'
import apiClient from '../api'

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!isLogin && formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        return
      }

      if (formData.username.length < 3) {
        setError('Username must be at least 3 characters long')
        return
      }

      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long')
        return
      }

      let response
      if (isLogin) {
        response = await apiClient.login(formData.username, formData.password)
      } else {
        response = await apiClient.register(formData.username, formData.password)
      }

      onLogin(response.user)
    } catch (error) {
      setError(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary-600 rounded-2xl shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to continue to your trading dashboard' : 'Start tracking your trading performance'}
          </p>
        </div>
        
        {/* Form */}
        <div className="card">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="form-group">
                <label htmlFor="username" className="label">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="input"
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="input pr-10"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              
              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="confirmPassword" className="label">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="input"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              )}
              
              {error && (
                <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
                  <p className="text-sm text-danger-600">{error}</p>
                </div>
              )}
              
              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </div>
                ) : isLogin ? (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Create Account
                  </>
                )}
              </button>
            </div>
          </form>
          
          {/* Toggle */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login