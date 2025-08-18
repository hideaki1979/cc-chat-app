import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test (refresh token is stored in httpOnly cookie)
    await page.context().clearCookies()
  })

  test('should redirect to login page when accessing root', async ({ page }) => {
    await page.goto('/')

    // Middleware should redirect to login page
    await expect(page).toHaveURL('/login')
    await expect(page.locator('h2')).toContainText('アカウントにログイン')
  })

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login')
    
    // Check URL and page content
    await expect(page).toHaveURL('/login')
    await expect(page.locator('h2')).toContainText('アカウントにログイン')
    
    // Check form fields are present
    await expect(page.locator('label:has-text("メールアドレス")')).toBeVisible()
    await expect(page.locator('label:has-text("パスワード")')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('ログイン')
  })

  test('should navigate to register page from login', async ({ page }) => {
    await page.goto('/login')
    
    // Click register link
    await page.click('text=新規登録')
    
    // Check URL and page content
    await expect(page).toHaveURL('/register')
    await expect(page.locator('h2')).toContainText('新規アカウント作成')
    
    // Check form fields are present
    await expect(page.locator('label:has-text("メールアドレス")')).toBeVisible()
    await expect(page.locator('label:has-text("ユーザー名")')).toBeVisible()
    await expect(page.locator('label:has-text("パスワード")')).toBeVisible()
    await expect(page.locator('label:has-text("パスワード確認")')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('アカウント作成')
  })

  test('should show validation errors on login form', async ({ page }) => {
    await page.goto('/login')
    
    // Submit form without filling fields
    await page.click('button[type="submit"]')
    
    // Check validation errors appear
    await expect(page.locator('text=メールアドレスは必須です')).toBeVisible()
    await expect(page.locator('text=パスワードは必須です')).toBeVisible()
  })

  test('should show validation errors on register form', async ({ page }) => {
    await page.goto('/register')
    
    // Submit form without filling fields
    await page.click('button[type="submit"]')
    
    // Check validation errors appear
    await expect(page.locator('text=メールアドレスは必須です')).toBeVisible()
    await expect(page.locator('text=ユーザー名は2文字以上である必要があります')).toBeVisible()
    await expect(page.locator('text=パスワードは8文字以上である必要があります')).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/login')
    
    // Enter invalid email
    await page.fill('input[type="email"]', 'invalid-email')
    await page.click('button[type="submit"]')
    
    // Check email validation error
    await expect(page.locator('text=有効なメールアドレスを入力してください')).toBeVisible()
  })

  test('should validate password confirmation on register', async ({ page }) => {
    await page.goto('/register')
    
    // Fill form with mismatched passwords
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="text"]', 'testuser')
    await page.fill('input[type="password"]:nth-of-type(1)', 'Password123')
    await page.fill('input[type="password"]:nth-of-type(2)', 'DifferentPassword123')
    
    await page.click('button[type="submit"]')
    
    // Check password confirmation error
    await expect(page.locator('text=パスワードが一致しません')).toBeVisible()
  })

  test('should show loading state during form submission', async ({ page }) => {
    await page.goto('/login')
    
    // Fill form
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    
    // Submit form and check loading state
    await page.click('button[type="submit"]')
    
    // Button should show loading state (though it might be brief)
    // This test might be flaky due to timing, but it's good to have
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })

  test('should navigate between login and register pages', async ({ page }) => {
    await page.goto('/login')
    
    // Click register link
    await page.click('text=新規登録')
    await expect(page).toHaveURL('/register')
    
    // Click login link
    await page.click('text=ログイン')
    await expect(page).toHaveURL('/login')
  })

  test('should redirect authenticated users from login page', async ({ page }) => {
    // First, simulate setting a refresh token cookie (would normally be set by successful login)
    await page.context().addCookies([{
      name: 'refresh_token',
      value: 'mock-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    }])

    // Try to access login page
    await page.goto('/login')

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard')
  })

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/chat')

    // Should be redirected to login with redirect parameter
    await expect(page).toHaveURL('/login?redirect=/chat')
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Block network requests to simulate API failure
    await page.route('**/auth/**', route => route.abort())
    
    await page.goto('/login')
    
    // Fill and submit form
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Should show error message (though exact message depends on implementation)
    // Wait for error to appear
    await page.waitForSelector('[role="alert"], .bg-red-50, text=失敗', { timeout: 5000 })
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/login')
    
    // Check form is still usable on mobile
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })
})