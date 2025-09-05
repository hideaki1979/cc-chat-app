import { storage, getStorageJson, setStorageJson } from '../../app/lib/storage'

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

describe('Storage Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SafeLocalStorage', () => {
    test('should return null when localStorage is not available', () => {
      // Mock localStorage getItem to throw error (simulating unavailable storage)
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      const result = storage.getItem('test-key')
      expect(result).toBeNull()
    })

    test('should handle localStorage getItem safely', () => {
      localStorageMock.getItem.mockReturnValue('test-value')
      const result = storage.getItem('test-key')
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key')
      expect(result).toBe('test-value')
    })

    test('should handle localStorage setItem safely', () => {
      storage.setItem('test-key', 'test-value')
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', 'test-value')
    })

    test('should handle localStorage removeItem safely', () => {
      storage.removeItem('test-key')
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key')
    })

    test('should handle localStorage errors gracefully', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      const result = storage.getItem('test-key')
      
      expect(result).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to get localStorage item: test-key',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('getStorageJson', () => {
    test('should return default value when item does not exist', () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      const result = getStorageJson('nonexistent-key', { default: true })
      
      expect(result).toEqual({ default: true })
    })

    test('should parse JSON data correctly', () => {
      const testData = { user: { id: '1', name: 'test' } }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(testData))
      
      const result = getStorageJson<typeof testData>('test-key', null)
      
      expect(result).toEqual(testData)
    })

    test('should return default value on JSON parse error', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValue('invalid-json')
      
      const result = getStorageJson('test-key', { fallback: true } as const)
      
      expect(result).toEqual({ fallback: true })
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to parse JSON from localStorage: test-key',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('setStorageJson', () => {
    test('should stringify and store JSON data', () => {
      const testData = { user: { id: '1', name: 'test' } }
      
      setStorageJson('test-key', testData)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData)
      )
    })

    test('should handle JSON stringify errors gracefully', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Create circular reference to cause JSON.stringify error
      const circularData: any = { name: 'test' }
      circularData.self = circularData
      
      setStorageJson('test-key', circularData)
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to stringify JSON for localStorage: test-key',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('SSR Compatibility', () => {
    test('should handle server-side rendering environment', () => {
      // Mock localStorage to be unavailable (simulating SSR)
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage not available in SSR')
      })
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage not available in SSR')
      })
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('localStorage not available in SSR')
      })

      // All operations should be safe in SSR
      expect(() => {
        storage.getItem('test')
        storage.setItem('test', 'value')
        storage.removeItem('test')
        getStorageJson('test', {})
        setStorageJson('test', {})
      }).not.toThrow()

      // Should return safe defaults
      expect(storage.getItem('test')).toBeNull()
      expect(getStorageJson('test', { default: true })).toEqual({ default: true })
    })
  })
})