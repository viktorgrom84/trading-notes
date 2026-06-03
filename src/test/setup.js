import '@testing-library/jest-dom'

// Keep the terminal clean — tests assert on thrown errors / return values,
// not on console output. Applied in beforeEach so it survives any
// vi.restoreAllMocks() calls made by individual test files.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// jsdom's reportException writes directly to process.stderr (bypasses
// console.error), so filter known test noise at the stream level.
const _originalStderrWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = (chunk, ...args) => {
  const msg = typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? ''
  if (
    msg.includes('API Error:') ||
    msg.includes('Error loading trades:') ||
    msg.includes('Uncaught [Error') ||
    msg.includes('Consider adding an error boundary') ||
    msg.includes('The above error occurred')
  ) return true
  return _originalStderrWrite(chunk, ...args)
}

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock window.location
delete window.location
window.location = { href: 'http://localhost:3000' }

// Mock window.matchMedia for Mantine UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver for Mantine UI
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  BrowserRouter: ({ children }) => children,
  Routes: ({ children }) => children,
  Route: ({ children }) => children,
}))
