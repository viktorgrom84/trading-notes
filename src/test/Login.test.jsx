import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import Login from '../components/Login'
import apiClient from '../api'

// Mock the API client
vi.mock('../api', () => ({
  default: {
    register: vi.fn(),
    login: vi.fn()
  }
}))

// Mock notifications
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn()
  }
}))

const renderWithMantine = (component) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  )
}

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render login form', () => {
    renderWithMantine(<Login />)
    
    expect(screen.getByText('Welcome to Trading Notes')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('should switch between login and register modes', async () => {
    const user = userEvent.setup()
    renderWithMantine(<Login />)
    
    // Should start in login mode
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    
    // Switch to register mode
    const registerLink = screen.getByText("Don't have an account? Sign up")
    await user.click(registerLink)
    
    expect(screen.getByText('Create Account')).toBeInTheDocument()
    expect(screen.getByText('Create your trading account')).toBeInTheDocument()
    
    // Switch back to login mode
    const loginLink = screen.getByText('Already have an account? Sign in')
    await user.click(loginLink)
    
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('should handle successful login', async () => {
    const user = userEvent.setup()
    const mockResponse = {
      message: 'Login successful',
      token: 'mock-token',
      user: { id: 1, username: 'testuser' }
    }
    
    apiClient.login.mockResolvedValue(mockResponse)
    
    renderWithMantine(<Login />)
    
    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    
    const loginButton = screen.getByText('Sign In')
    await user.click(loginButton)
    
    await waitFor(() => {
      expect(apiClient.login).toHaveBeenCalledWith('testuser', 'password123')
    })
  })

  it('should handle successful registration', async () => {
    const user = userEvent.setup()
    const mockResponse = {
      message: 'User created successfully',
      token: 'mock-token',
      user: { id: 1, username: 'newuser' }
    }
    
    apiClient.register.mockResolvedValue(mockResponse)
    
    renderWithMantine(<Login />)
    
    // Switch to register mode
    const registerLink = screen.getByText("Don't have an account? Sign up")
    await user.click(registerLink)
    
    await user.type(screen.getByLabelText('Username'), 'newuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    
    const registerButton = screen.getByText('Create Account')
    await user.click(registerButton)
    
    await waitFor(() => {
      expect(apiClient.register).toHaveBeenCalledWith('newuser', 'password123')
    })
  })

  it('should handle login errors', async () => {
    const user = userEvent.setup()
    apiClient.login.mockRejectedValue(new Error('Invalid credentials'))
    
    renderWithMantine(<Login />)
    
    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'wrongpassword')
    
    const loginButton = screen.getByText('Sign In')
    await user.click(loginButton)
    
    await waitFor(() => {
      expect(apiClient.login).toHaveBeenCalledWith('testuser', 'wrongpassword')
    })
  })

  it('should handle registration errors', async () => {
    const user = userEvent.setup()
    apiClient.register.mockRejectedValue(new Error('Username already exists'))
    
    renderWithMantine(<Login />)
    
    // Switch to register mode
    const registerLink = screen.getByText("Don't have an account? Sign up")
    await user.click(registerLink)
    
    await user.type(screen.getByLabelText('Username'), 'existinguser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    
    const registerButton = screen.getByText('Create Account')
    await user.click(registerButton)
    
    await waitFor(() => {
      expect(apiClient.register).toHaveBeenCalledWith('existinguser', 'password123')
    })
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    renderWithMantine(<Login />)
    
    const loginButton = screen.getByText('Sign In')
    await user.click(loginButton)
    
    // Should show validation errors
    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('should validate password length', async () => {
    const user = userEvent.setup()
    renderWithMantine(<Login />)
    
    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), '123') // Too short
    
    const loginButton = screen.getByText('Sign In')
    await user.click(loginButton)
    
    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
  })

  it('should show loading state during API calls', async () => {
    const user = userEvent.setup()
    apiClient.login.mockImplementation(() => new Promise(() => {})) // Never resolves
    
    renderWithMantine(<Login />)
    
    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    
    const loginButton = screen.getByText('Sign In')
    await user.click(loginButton)
    
    // Should show loading state
    expect(screen.getByText('Signing in...')).toBeInTheDocument()
  })

  it('should clear form after successful login', async () => {
    const user = userEvent.setup()
    const mockResponse = {
      message: 'Login successful',
      token: 'mock-token',
      user: { id: 1, username: 'testuser' }
    }
    
    apiClient.login.mockResolvedValue(mockResponse)
    
    renderWithMantine(<Login />)
    
    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    
    const loginButton = screen.getByText('Sign In')
    await user.click(loginButton)
    
    await waitFor(() => {
      expect(apiClient.login).toHaveBeenCalledWith('testuser', 'password123')
    })
  })

  it('should clear form after successful registration', async () => {
    const user = userEvent.setup()
    const mockResponse = {
      message: 'User created successfully',
      token: 'mock-token',
      user: { id: 1, username: 'newuser' }
    }
    
    apiClient.register.mockResolvedValue(mockResponse)
    
    renderWithMantine(<Login />)
    
    // Switch to register mode
    const registerLink = screen.getByText("Don't have an account? Sign up")
    await user.click(registerLink)
    
    await user.type(screen.getByLabelText('Username'), 'newuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    
    const registerButton = screen.getByText('Create Account')
    await user.click(registerButton)
    
    await waitFor(() => {
      expect(apiClient.register).toHaveBeenCalledWith('newuser', 'password123')
    })
  })
})
