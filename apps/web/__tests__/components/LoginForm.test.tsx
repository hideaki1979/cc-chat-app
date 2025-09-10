import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../../app/components/LoginForm'
import { FieldErrors } from 'react-hook-form'
import { LoginFormData } from '../../app/lib/validations'

// Mock Next.js router
const mockPush = jest.fn()
const mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}))

// Type definitions for mocked hook returns
interface MockUseLoginFormReturn {
  handleSubmit: (fn: (data: LoginFormData) => void | Promise<void>) => (e: React.FormEvent) => void;
  formState: { errors: FieldErrors<LoginFormData> };
  register: (name: keyof LoginFormData) => {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
    name: string;
    ref: React.Ref<HTMLInputElement>;
  };
  login: (data: LoginFormData) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

interface MockUseLoginFormLogicReturn {
  handleLogin: (data: LoginFormData) => Promise<void>;
}

// Mock functions
const mockHandleSubmit = jest.fn()
const mockRegister = jest.fn()
const mockLogin = jest.fn()
const mockClearError = jest.fn()
const mockHandleLogin = jest.fn()

// Create mock return objects
const mockUseLoginFormReturn: MockUseLoginFormReturn = {
  handleSubmit: mockHandleSubmit,
  formState: { errors: {} },
  register: mockRegister,
  login: mockLogin,
  isLoading: false,
  error: null,
  clearError: mockClearError,
}

const mockUseLoginFormLogicReturn: MockUseLoginFormLogicReturn = {
  handleLogin: mockHandleLogin,
}

jest.mock('../../app/hooks/useLoginForm', () => ({
  useLoginForm: jest.fn(() => mockUseLoginFormReturn),
}))

jest.mock('../../app/hooks/useLoginFormLogic', () => ({
  useLoginFormLogic: jest.fn(() => mockUseLoginFormLogicReturn),
}))

// Get the mocked hooks for dynamic updates
const mockUseLoginForm = require('../../app/hooks/useLoginForm').useLoginForm as jest.MockedFunction<() => MockUseLoginFormReturn>
const mockUseLoginFormLogic = require('../../app/hooks/useLoginFormLogic').useLoginFormLogic as jest.MockedFunction<() => MockUseLoginFormLogicReturn>

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
    
    // Reset mock implementations
    mockHandleSubmit.mockImplementation((fn) => (e: React.FormEvent) => {
      e.preventDefault()
      fn({ email: 'test@example.com', password: 'Password123' })
    })
    mockRegister.mockReturnValue({
      onChange: jest.fn(),
      onBlur: jest.fn(),
      name: 'test',
      ref: { current: null },
    })
    mockLogin.mockResolvedValue(true)
    mockHandleLogin.mockResolvedValue(undefined)
    
    // Reset the mock return values to defaults
    mockUseLoginForm.mockReturnValue({
      ...mockUseLoginFormReturn,
      isLoading: false,
      error: null,
      formState: { errors: {} },
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
    render(<LoginForm />)
    
    // Find and click the submit button
    const submitButton = screen.getByRole('button', { name: /ログイン/i })
    await user.click(submitButton)
    
    // Check if the handleSubmit was called
    await waitFor(() => {
      expect(mockHandleSubmit).toHaveBeenCalled()
    })
  })

  test('displays validation errors', async () => {
    // Mock validation errors
    mockUseLoginForm.mockReturnValue({
      ...mockUseLoginFormReturn,
      formState: {
        errors: {
          email: { 
            message: 'メールアドレスは必須です',
            type: 'required'
          },
          password: { 
            message: 'パスワードは必須です',
            type: 'required'
          },
        }
      },
    })
    
    render(<LoginForm />)
    
    expect(screen.getByText('メールアドレスは必須です')).toBeInTheDocument()
    expect(screen.getByText('パスワードは必須です')).toBeInTheDocument()
  })

  test('displays loading state', () => {
    mockUseLoginForm.mockReturnValue({
      ...mockUseLoginFormReturn,
      isLoading: true,
    })
    
    render(<LoginForm />)
    
    const submitButton = screen.getByRole('button')
    expect(submitButton).toBeDisabled()
    expect(submitButton).toHaveTextContent('処理中')
  })

  test('displays error message', () => {
    const errorMessage = 'Invalid credentials'
    mockUseLoginForm.mockReturnValue({
      ...mockUseLoginFormReturn,
      error: errorMessage,
    })
    
    render(<LoginForm />)
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  test('calls useLoginFormLogic with correct parameters', () => {
    render(<LoginForm />)
    
    expect(mockUseLoginFormLogic).toHaveBeenCalledWith(mockLogin, mockClearError)
  })

  test('has proper form accessibility', () => {
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/メールアドレス/i)
    const passwordInput = screen.getByLabelText(/パスワード/i)
    
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
  })
})