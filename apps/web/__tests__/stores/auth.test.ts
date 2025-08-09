import { act, renderHook } from '@testing-library/react'
import { useAuthStore } from '../../app/stores/auth'
import { api } from '../../app/lib/api'

// Mock axios
jest.mock('../../app/lib/api')
const mockedApi = api as jest.Mocked<typeof api>

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)

    // Reset store state
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,
    })
  })

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore())

      expect(result.current.user).toBeNull()
      expect(result.current.accessToken).toBeNull()
      // refreshToken はストアから削除済み
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Login', () => {
    test('should login successfully', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'testuser',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }

      const mockResponse = {
        data: {
          user: mockUser,
          token: 'access-token',
        },
      }

      mockedApi.post.mockResolvedValueOnce(mockResponse)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123',
        })
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.accessToken).toBe('access-token')
      // refreshToken はストアから削除済み
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()

      // アクセストークンはメモリのみ、Cookieはサーバー管理
    })

    test('should handle login error', async () => {
      const errorMessage = 'Invalid credentials'
      mockedApi.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com',
            password: 'wrongpassword',
          })
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.user).toBeNull()
      expect(result.current.accessToken).toBeNull()
      // refreshToken はストアから削除済み
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(errorMessage)

      // ローカルストレージ操作は廃止
    })
  })

  describe('Register', () => {
    test('should register successfully', async () => {
      const mockUser = {
        id: '1',
        email: 'newuser@example.com',
        name: 'newuser',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }

      const mockResponse = {
        data: {
          user: mockUser,
          token: 'access-token',
        },
      }

      mockedApi.post.mockResolvedValueOnce(mockResponse)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.register({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'Password123',
          confirmPassword: 'Password123',
        })
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.accessToken).toBe('access-token')
      // refreshToken はストアから削除済み
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    test('should handle register error', async () => {
      const errorMessage = 'Email already exists'
      mockedApi.post.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.register({
            email: 'existing@example.com',
            username: 'existinguser',
            password: 'Password123',
            confirmPassword: 'Password123',
          })
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.user).toBeNull()
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('Logout', () => {
    test('should logout and clear state', () => {
      // Set initial state
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'testuser',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        accessToken: 'access-token',
        isLoading: false,
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.accessToken).toBeNull()
      // refreshToken はストアから削除済み
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()

      // ローカルストレージ操作は廃止
    })
  })

  describe('Error Management', () => {
    test('should set and clear error', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setError('Test error')
      })
      expect(result.current.error).toBe('Test error')

      act(() => {
        result.current.clearError()
      })
      expect(result.current.error).toBeNull()
    })
  })

  describe('Loading State', () => {
    test('should set loading state', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setLoading(true)
      })
      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })
      expect(result.current.isLoading).toBe(false)
    })
  })
})