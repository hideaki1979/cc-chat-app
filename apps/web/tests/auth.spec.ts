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
    await expect(page.getByLabel('メールアドレス')).toBeVisible()
    await expect(page.getByLabel('パスワード')).toBeVisible()
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
    await expect(page.getByLabel('メールアドレス')).toBeVisible()
    await expect(page.getByLabel('ユーザー名')).toBeVisible()
    await expect(page.getByLabel('パスワード', { exact: true })).toBeVisible()
    await expect(page.getByLabel('パスワード確認')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('アカウント作成')
  })

  test('should allow valid login form submission', async ({ page }) => {
    await page.goto('/login')
    
    // Fill form with valid data
    await page.getByLabel('メールアドレス').fill('test@example.com')
    await page.getByLabel('パスワード').fill('ValidPassword123')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Form should be submittable (no client-side validation errors blocking submission)
    // We can't test actual authentication without a backend, but form should process
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should allow valid registration form submission', async ({ page }) => {
    await page.goto('/register')
    
    // Fill form with valid data
    await page.getByLabel('メールアドレス').fill('newuser@example.com')
    await page.getByLabel('ユーザー名').fill('newuser')
    await page.getByLabel('パスワード', { exact: true }).fill('ValidPassword123')
    await page.getByLabel('パスワード確認').fill('ValidPassword123')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Form should be submittable (no client-side validation errors blocking submission)
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should handle form accessibility', async ({ page }) => {
    await page.goto('/login')
    
    // Check form has proper accessibility attributes
    const emailInput = page.getByLabel('メールアドレス')
    const passwordInput = page.getByLabel('パスワード')
    
    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('autoComplete', 'email')
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
    
    // Form should be keyboard navigable
    await emailInput.focus()
    await expect(emailInput).toBeFocused()
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

    // Should be redirected to login with redirect parameter (URL encoded or decoded)
    await expect(page).toHaveURL(/\/login\?redirect=(?:\/chat|%2Fchat)/)
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Block network requests to simulate API failure
    await page.route('**/api/backend/**', route => route.abort())
    
    await page.goto('/login')
    
    // Fill and submit form
    await page.getByLabel('メールアドレス').fill('test@example.com')
    await page.getByLabel('パスワード').fill('password123')
    await page.click('button[type="submit"]')
    
    // Should handle error gracefully (form should remain accessible)
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    
    // Form fields should still be functional after error
    await expect(page.getByLabel('メールアドレス')).toBeVisible()
    await expect(page.getByLabel('パスワード')).toBeVisible()
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