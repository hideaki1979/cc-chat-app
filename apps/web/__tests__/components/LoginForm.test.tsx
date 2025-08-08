import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../../app/components/LoginForm'
import { useAuthStore } from '../../app/stores/auth'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

// Mock auth store
jest.mock('../../app/stores/auth')
const mockedUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

describe('LoginForm Component', () => {
  const mockLogin = jest.fn()
  const mockClearError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
    
    mockedUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      user: null,
      accessToken: null,
      refreshToken: null,
      register: jest.fn(),
      logout: jest.fn(),
      refreshAccessToken: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
    })
  })

  test('renders login form correctly', () => {
    render(<LoginForm />)
    
    expect(screen.getByRole('heading', { name: /アカウントにログイン/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/メールアドレス/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/パスワード/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument()
    expect(screen.getByText(/新規登録/i)).toBeInTheDocument()
  })

  test('submits form with valid data', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce(undefined)
    
    render(<LoginForm />)
    
    // Fill form
    await user.type(screen.getByLabelText(/メールアドレス/i), 'test@example.com')
    await user.type(screen.getByLabelText(/パスワード/i), 'password123')
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /ログイン/i }))
    
    // Check if login was called with correct data
    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled()
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  test('does not call login when required fields are empty', async () => {
    const user = userEvent.setup()
    
    render(<LoginForm />)
    
    // Submit form without filling fields
    await user.click(screen.getByRole('button', { name: /ログイン/i }))
    
    // Check that login was not called due to validation
    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled()
    }, { timeout: 1000 })
    
    // Also check that there are validation error elements present
    expect(document.querySelector('.text-red-600')).toBeTruthy()
  })

  test('does not call login when email format is invalid', async () => {
    const user = userEvent.setup()
    
    render(<LoginForm />)
    
    // Enter invalid email
    await user.type(screen.getByLabelText(/メールアドレス/i), 'invalid-email')
    await user.type(screen.getByLabelText(/パスワード/i), 'password123')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))
    
    // Wait and check that login was not called due to validation
    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  test('validates password length', async () => {
    const user = userEvent.setup()
    
    render(<LoginForm />)
    
    // Enter short password
    await user.type(screen.getByLabelText(/メールアドレス/i), 'test@example.com')
    await user.type(screen.getByLabelText(/パスワード/i), '123')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))
    
    // Check password validation error
    await waitFor(() => {
      expect(screen.getByText(/パスワードは6文字以上である必要があります/i)).toBeInTheDocument()
    })
    
    expect(mockLogin).not.toHaveBeenCalled()
  })

  test('displays loading state', () => {
    mockedUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: true,
      error: null,
      clearError: mockClearError,
      user: null,
      accessToken: null,
      refreshToken: null,
      register: jest.fn(),
      logout: jest.fn(),
      refreshAccessToken: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
    })
    
    render(<LoginForm />)
    
    // Check loading state
    expect(screen.getByText(/処理中/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /処理中/i })).toBeDisabled()
  })

  test('displays error message', () => {
    const errorMessage = 'Invalid credentials'
    mockedUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: errorMessage,
      clearError: mockClearError,
      user: null,
      accessToken: null,
      refreshToken: null,
      register: jest.fn(),
      logout: jest.fn(),
      refreshAccessToken: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
    })
    
    render(<LoginForm />)
    
    // Check error message is displayed
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  test('handles login failure', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(new Error('Login failed'))
    
    render(<LoginForm />)
    
    // Fill and submit form
    await user.type(screen.getByLabelText(/メールアドレス/i), 'test@example.com')
    await user.type(screen.getByLabelText(/パスワード/i), 'password123')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))
    
    // Check that login was called but navigation didn't happen
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
    })
    
    expect(mockPush).not.toHaveBeenCalled()
  })

  test('has proper form accessibility', () => {
    render(<LoginForm />)
    
    // Check form has proper labels and structure
    const emailInput = screen.getByLabelText(/メールアドレス/i)
    const passwordInput = screen.getByLabelText(/パスワード/i)
    
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
  })
})