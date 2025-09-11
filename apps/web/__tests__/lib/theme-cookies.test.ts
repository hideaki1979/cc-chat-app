import { exec } from 'child_process'
import { ThemeCookieManager } from '../../app/lib/theme-cookies'

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
})

describe('ThemeCookieManager', () => {
  beforeEach(() => {
    // Clear cookies before each test
    document.cookie = ''
  })

  describe('getTheme', () => {
    test('should return null when no theme cookie exists', () => {
      const theme = ThemeCookieManager.getTheme()
      expect(theme).toBeNull()
    })

    test('should return theme from cookie', () => {
      document.cookie = 'theme-preference=dark'
      const theme = ThemeCookieManager.getTheme()
      expect(theme).toBe('dark')
    })

    test('should return null for invalid theme value', () => {
      document.cookie = 'theme-preference=invalid'
      const theme = ThemeCookieManager.getTheme()
      expect(theme).toBeNull()
    })

    test('should handle multiple cookies', () => {
      document.cookie = 'other-cookie=value; theme-preference=light; another=test'
      const theme = ThemeCookieManager.getTheme()
      expect(theme).toBe('light')
    })

    test('should handle SSR environment gracefully', () => {
      const originalDocument = global.document
      const originalDescriptor = Object.getOwnPropertyDescriptor(global, 'document')

      try {
        // documentプロパティを一時的に削除
        Object.defineProperty(global, 'document', {
          value: undefined,
          configurable: true
        })

        const theme = ThemeCookieManager.getTheme()
        expect(theme).toBeNull()
      } finally {
        // 元の状態を復元
        if (originalDescriptor) {
          Object.defineProperty(global, 'document', originalDescriptor)
        } else {
          global.document = originalDocument
        }
      }
    })
  })

  describe('setTheme', () => {
    test('should set theme cookie with correct attributes', () => {
      const cookieSetter = jest.fn();
      Object.defineProperty(document, 'cookie', {
        set: cookieSetter,
        get: jest.fn(() => 'theme-preference=dark'),
      });

      ThemeCookieManager.setTheme('dark')

      expect(cookieSetter).toHaveBeenCalledWith(
        'theme-preference=dark; max-age=31536000; path=/; SameSite=Strict'
      );
    });

    test('should handle different theme values', () => {
      ThemeCookieManager.setTheme('system')
      expect(document.cookie).toContain('theme-preference=system')

      ThemeCookieManager.setTheme('light')
      expect(document.cookie).toContain('theme-preference=light')
    })

    test('should handle SSR environment gracefully', () => {
      const originalDocument = global.document
      delete (global as any).document

      expect(() => {
        ThemeCookieManager.setTheme('dark')
      }).not.toThrow()

      global.document = originalDocument
    })
  })

  describe('removeTheme', () => {
    test('should remove theme cookie', () => {
      // Set a theme first
      ThemeCookieManager.setTheme('dark')
      expect(document.cookie).toContain('theme-preference=dark')

      // Remove it
      ThemeCookieManager.removeTheme()

      // クッキーが削除されたことを確認（値が取得できないこと）
      const theme = ThemeCookieManager.getTheme();
      expect(theme).toBeNull();

    })

    test('should handle SSR environment gracefully', () => {
      const originalDocument = global.document
      delete (global as any).document

      expect(() => {
        ThemeCookieManager.removeTheme()
      }).not.toThrow()

      global.document = originalDocument
    })
  })

  describe('TASK-002 Compliance', () => {
    test('should not use localStorage for theme persistence', () => {
      // Verify that localStorage is never accessed
      const localStorageSpy = jest.spyOn(Storage.prototype, 'getItem')
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')

      ThemeCookieManager.setTheme('dark')
      const theme = ThemeCookieManager.getTheme()
      ThemeCookieManager.removeTheme()

      expect(localStorageSpy).not.toHaveBeenCalled()
      expect(setItemSpy).not.toHaveBeenCalled()

      localStorageSpy.mockRestore()
      setItemSpy.mockRestore()
    })

    test('should use Cookie-based storage only', () => {
      // Set theme and verify it's stored in cookie
      ThemeCookieManager.setTheme('dark')

      // Verify we can retrieve it from cookie without localStorage
      const theme = ThemeCookieManager.getTheme()
      expect(theme).toBe('dark')
      expect(document.cookie).toContain('theme-preference=dark')
    })
  })
})