import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from '../../app/components/RegisterForm'
import { useAuthStore } from '../../app/stores/auth'

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

// Mock auth store
jest.mock('../../app/stores/auth')
const mockedUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

describe('RegisterForm Component', () => {
  const mockRegister = jest.fn()
  const mockClearError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
    
    mockedUseAuthStore.mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      user: null,
      accessToken: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshAccessToken: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
    })
  })

  test('renders register form correctly', () => {
    render(<RegisterForm />)
    
    expect(screen.getByRole('heading', { name: /新規アカウント作成/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/メールアドレス/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ユーザー名/i)).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    expect(screen.getByLabelText(/パスワード確認/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /アカウント作成/i })).toBeInTheDocument()
    expect(screen.getByText(/ログイン/i)).toBeInTheDocument()
  })

  test('submits form with valid data', async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValueOnce({ ok: true })
    
    render(<RegisterForm />)
    
    // Fill form
    await user.type(screen.getByLabelText(/メールアドレス/i), 'newuser@example.com')
    await user.type(screen.getByLabelText(/ユーザー名/i), 'newuser123')
    await user.type(screen.getByLabelText('パスワード'), 'Password123')
    await user.type(screen.getByLabelText(/パスワード確認/i), 'Password123')
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /アカウント作成/i }))
    
    // Check if register was called with correct data
    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled()
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        username: 'newuser123',
        password: 'Password123',
        confirmPassword: 'Password123',
      })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  test('does not call register when form is invalid', async () => {
    const user = userEvent.setup()
    
    render(<RegisterForm />)
    
    // Submit form without filling fields
    await user.click(screen.getByRole('button', { name: /アカウント作成/i }))
    
    // Wait a bit and check that register was not called due to validation
    await waitFor(() => {
      expect(mockRegister).not.toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  test('validates username format', async () => {
    const user = userEvent.setup()
    
    render(<RegisterForm />)
    
    // Enter invalid username with special characters
    await user.type(screen.getByLabelText(/ユーザー名/i), 'user@name!')
    await user.click(screen.getByRole('button', { name: /アカウント作成/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/ユーザー名には半角英数字、アンダースコア、ハイフンのみ使用できます/i)).toBeInTheDocument()
    })
    
    expect(mockRegister).not.toHaveBeenCalled()
  })

  test('validates password strength', async () => {
    const user = userEvent.setup()
    
    render(<RegisterForm />)
    
    // Enter weak password (no uppercase, no numbers)
    await user.type(screen.getByLabelText(/メールアドレス/i), 'test@example.com')
    await user.type(screen.getByLabelText(/ユーザー名/i), 'testuser')
    await user.type(screen.getByLabelText('パスワード'), 'password')
    await user.type(screen.getByLabelText(/パスワード確認/i), 'password')
    await user.click(screen.getByRole('button', { name: /アカウント作成/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/パスワードは大文字、小文字、数字を含む必要があります/i)).toBeInTheDocument()
    })
    
    expect(mockRegister).not.toHaveBeenCalled()
  })

  test('validates password confirmation', async () => {
    const user = userEvent.setup()
    
    render(<RegisterForm />)
    
    // Enter mismatched passwords
    await user.type(screen.getByLabelText(/メールアドレス/i), 'test@example.com')
    await user.type(screen.getByLabelText(/ユーザー名/i), 'testuser')
    await user.type(screen.getByLabelText('パスワード'), 'Password123')
    await user.type(screen.getByLabelText(/パスワード確認/i), 'DifferentPassword123')
    await user.click(screen.getByRole('button', { name: /アカウント作成/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/パスワードが一致しません/i)).toBeInTheDocument()
    })
    
    expect(mockRegister).not.toHaveBeenCalled()
  })

  test('displays loading state', () => {
    mockedUseAuthStore.mockReturnValue({
      register: mockRegister,
      isLoading: true,
      error: null,
      clearError: mockClearError,
      user: null,
      accessToken: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshAccessToken: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
    })
    
    render(<RegisterForm />)
    
    // Check loading state
    expect(screen.getByText(/処理中/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /処理中/i })).toBeDisabled()
  })

  test('displays error message', () => {
    const errorMessage = 'Email already exists'
    mockedUseAuthStore.mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: errorMessage,
      clearError: mockClearError,
      user: null,
      accessToken: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshAccessToken: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
    })
    
    render(<RegisterForm />)
    
    // Check error message is displayed
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  test('shows helper text for form fields', () => {
    render(<RegisterForm />)
    
    // Check helper texts
    expect(screen.getByText(/半角英数字、アンダースコア、ハイフンのみ使用可能/i)).toBeInTheDocument()
    expect(screen.getByText(/8文字以上、大文字・小文字・数字を含む/i)).toBeInTheDocument()
  })

  test('handles registration failure', async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValueOnce(new Error('Registration failed'))
    
    render(<RegisterForm />)
    
    // Fill and submit form
    await user.type(screen.getByLabelText(/メールアドレス/i), 'test@example.com')
    await user.type(screen.getByLabelText(/ユーザー名/i), 'testuser')
    await user.type(screen.getByLabelText('パスワード'), 'Password123')
    await user.type(screen.getByLabelText(/パスワード確認/i), 'Password123')
    await user.click(screen.getByRole('button', { name: /アカウント作成/i }))
    
    // Check that register was called but navigation didn't happen
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
    })
    
    expect(mockPush).not.toHaveBeenCalled()
  })

  test('has proper form accessibility', () => {
    render(<RegisterForm />)
    
    // Check form has proper labels and structure
    const emailInput = screen.getByLabelText(/メールアドレス/i)
    const usernameInput = screen.getByLabelText(/ユーザー名/i)
    const passwordInput = screen.getByLabelText('パスワード')
    const confirmPasswordInput = screen.getByLabelText(/パスワード確認/i)
    
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
    expect(usernameInput).toHaveAttribute('type', 'text')
    expect(usernameInput).toHaveAttribute('autoComplete', 'username')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password')
    expect(confirmPasswordInput).toHaveAttribute('type', 'password')
    expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password')
  })

  // E2Eから移管：詳細バリデーションテスト
  describe('Detailed Validation Tests (from E2E)', () => {
    test('prevents submission with invalid data', async () => {
      const user = userEvent.setup()
      
      render(<RegisterForm />)
      
      // 無効なデータで登録を試行
      await user.type(screen.getByLabelText(/メールアドレス/i), 'invalid-email')
      await user.type(screen.getByLabelText(/ユーザー名/i), 'u') // 短すぎるユーザー名
      await user.type(screen.getByLabelText('パスワード'), '123') // 短すぎるパスワード
      await user.type(screen.getByLabelText(/パスワード確認/i), '123') // パスワード確認
      
      // フォームをsubmit
      const submitButton = screen.getByRole('button', { name: /アカウント作成/i })
      await user.click(submitButton)
      
      // 無効なデータのため、registerが呼ばれないことを確認
      // （React Hook Formのバリデーションが動作していることの間接的な確認）
      await waitFor(() => {
        expect(mockRegister).not.toHaveBeenCalled()
      }, { timeout: 1000 })
      
      // フォームが送信されていないことを確認
      expect(mockPush).not.toHaveBeenCalled()
    })

    test('handles duplicate email registration gracefully', async () => {
      const user = userEvent.setup()
      const duplicateErrorMessage = 'すでに登録済みのメールアドレスです'
      
      mockedUseAuthStore.mockReturnValue({
        register: mockRegister,
        isLoading: false,
        error: duplicateErrorMessage,
        clearError: mockClearError,
        user: null,
        accessToken: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshAccessToken: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
      })
      
      render(<RegisterForm />)
      
      // 重複メールエラーが表示されることを確認
      expect(screen.getByText(duplicateErrorMessage)).toBeInTheDocument()
      expect(screen.getByRole('alert')).toContainElement(screen.getByText(duplicateErrorMessage))
    })

    test('validates password strength requirements', async () => {
      const user = userEvent.setup()
      
      render(<RegisterForm />)
      
      // 弱いパスワードでテスト
      await user.type(screen.getByLabelText(/メールアドレス/i), 'test@example.com')
      await user.type(screen.getByLabelText(/ユーザー名/i), 'testuser')
      await user.type(screen.getByLabelText('パスワード'), 'weak') // 弱いパスワード
      await user.type(screen.getByLabelText(/パスワード確認/i), 'weak')
      await user.click(screen.getByRole('button', { name: /アカウント作成/i }))
      
      // パスワード強度エラーが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText(/パスワードは8文字以上である必要があります/)).toBeInTheDocument()
      })
    })

    test('maintains form state during validation errors', async () => {
      const user = userEvent.setup()
      
      render(<RegisterForm />)
      
      const testName = 'FormStateTestUser'
      const testEmail = 'test-form-state@example.com'
      
      // 正しいデータを一部入力し、一部を無効にする
      await user.type(screen.getByLabelText(/ユーザー名/i), testName)
      await user.type(screen.getByLabelText(/メールアドレス/i), testEmail)
      await user.type(screen.getByLabelText('パスワード'), 'weak') // 無効なパスワード
      await user.type(screen.getByLabelText(/パスワード確認/i), 'weak')
      await user.click(screen.getByRole('button', { name: /アカウント作成/i }))
      
      // バリデーションエラー後も、有効な入力値が保持されていることを確認
      await waitFor(() => {
        expect(screen.getByDisplayValue(testName)).toBeInTheDocument()
        expect(screen.getByDisplayValue(testEmail)).toBeInTheDocument()
      })
    })

    test('shows proper error styling and accessibility', () => {
      const errorMessage = 'Registration error occurred'
      mockedUseAuthStore.mockReturnValue({
        register: mockRegister,
        isLoading: false,
        error: errorMessage,
        clearError: mockClearError,
        user: null,
        accessToken: null,
        login: jest.fn(),
        logout: jest.fn(),
        refreshAccessToken: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
      })
      
      render(<RegisterForm />)
      
      // エラー表示のスタイリングを確認
      const errorElement = screen.getByText(errorMessage)
      expect(errorElement).toBeInTheDocument()
      
      // エラーコンテナが適切なスタイルを持つことを確認
      const errorContainer = errorElement.closest('.bg-red-50')
      expect(errorContainer).toBeInTheDocument()
      expect(errorContainer).toHaveClass('bg-red-50')
    })
  })
})