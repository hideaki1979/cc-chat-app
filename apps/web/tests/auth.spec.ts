import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('should display home page with login and register buttons', async ({ page }) => {
    await page.goto('/')

    // Check page title and heading
    await expect(page.locator('h1')).toContainText('チャットアプリへようこそ')
    
    // Check login and register buttons are present
    await expect(page.locator('text=ログイン')).toBeVisible()
    await expect(page.locator('text=新規登録')).toBeVisible()
  })

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/')
    
    // Click login button
    await page.click('text=ログイン')
    
    // Check URL and page content
    await expect(page).toHaveURL('/login')
    await expect(page.locator('h2')).toContainText('アカウントにログイン')
    
    // Check form fields are present
    await expect(page.locator('label:has-text("メールアドレス")')).toBeVisible()
    await expect(page.locator('label:has-text("パスワード")')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('ログイン')
  })

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/')
    
    // Click register button
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