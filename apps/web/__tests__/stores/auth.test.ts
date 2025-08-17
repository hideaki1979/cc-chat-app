import { act, renderHook } from '@testing-library/react'
import { useAuthStore } from '../../app/stores/auth'

// Mock fetch
global.fetch = jest.fn()

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
    // Reset fetch mock
    ;(global.fetch as jest.Mock).mockClear()

    // Reset store state
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: false,
      isInitialized: false,
      error: null,
    })
  })

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore())

      expect(result.current.user).toBeNull()
      expect(result.current.accessToken).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isInitialized).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.initializeAuth).toBe('function')
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
        user: mockUser,
        token: 'access-token',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const { result } = renderHook(() => useAuthStore())

      let loginResult: boolean
      await act(async () => {
        loginResult = await result.current.login({
          email: 'test@example.com',
          password: 'password123',
        })
      })

      expect(loginResult).toBe(true)
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.accessToken).toBe('access-token')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isInitialized).toBe(true)
      expect(result.current.error).toBeNull()
    })

    test('should handle login error', async () => {
      const errorMessage = 'Invalid credentials'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: errorMessage }),
      })

      const { result } = renderHook(() => useAuthStore())

      let loginResult: boolean
      await act(async () => {
        loginResult = await result.current.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      })

      expect(loginResult).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.accessToken).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
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
        user: mockUser,
        token: 'access-token',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const { result } = renderHook(() => useAuthStore())

      let registerResult: any
      await act(async () => {
        registerResult = await result.current.register({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'Password123',
          confirmPassword: 'Password123',
        })
      })

      expect(registerResult.ok).toBe(true)
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.accessToken).toBe('access-token')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isInitialized).toBe(true)
      expect(result.current.error).toBeNull()
    })

    test('should handle register error', async () => {
      const errorMessage = 'Email already exists'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: errorMessage }),
      })

      const { result } = renderHook(() => useAuthStore())

      let registerResult: any
      await act(async () => {
        registerResult = await result.current.register({
          email: 'existing@example.com',
          username: 'existinguser',
          password: 'Password123',
          confirmPassword: 'Password123',
        })
      })

      expect(registerResult.ok).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('Initialize Auth', () => {
    test('should initialize auth successfully', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'testuser',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }

      // Mock refresh token call
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'new-access-token' }),
        })
        // Mock profile call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initializeAuth()
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.accessToken).toBe('new-access-token')
      expect(result.current.isInitialized).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    test('should handle initialization failure', async () => {
      // Mock refresh token failure
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initializeAuth()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.accessToken).toBeNull()
      expect(result.current.isInitialized).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Logout', () => {
    test('should logout and clear state', async () => {
      // Mock logout API call
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      })

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
        isInitialized: true,
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.accessToken).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isInitialized).toBe(true)
      expect(result.current.error).toBeNull()
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