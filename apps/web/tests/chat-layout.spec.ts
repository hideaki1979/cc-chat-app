import { test, expect } from '@playwright/test';

test.describe('Chat Layout Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for chat page access
    await page.goto('/');
    
    // Add authentication mock by setting localStorage
    await page.evaluate(() => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            username: 'testuser',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          isLoading: false,
          error: null
        },
        version: 0
      }));
    });
  });

  test('should display chat layout with sidebar and header', async ({ page }) => {
    await page.goto('/chat');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check main layout elements
    await expect(page.locator('[data-testid="test-sidebar"]')).toBeVisible();
    await expect(page.locator('.flex.h-screen.bg-gray-50')).toBeVisible();
    
    // Check header is present
    await expect(page.locator('text=チャットルームを選択してください')).toBeVisible();
  });

  test('should toggle sidebar using hamburger menu on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Find hamburger menu button (should be visible on mobile)
    const hamburgerButton = page.locator('button[aria-label*="サイドバーを"]').first();
    await expect(hamburgerButton).toBeVisible();
    
    // Check initial state - should show "開く" (open) since sidebar starts closed on mobile
    await expect(hamburgerButton).toHaveAttribute('aria-label', 'サイドバーを開く');
    
    // Click to open sidebar
    await hamburgerButton.click();
    
    // Check that aria-label changed to "閉じる" (close)
    await expect(hamburgerButton).toHaveAttribute('aria-label', 'サイドバーを閉じる');
    
    // Click again to close sidebar
    await hamburgerButton.click();
    
    // Should return to "開く" (open)
    await expect(hamburgerButton).toHaveAttribute('aria-label', 'サイドバーを開く');
  });

  test('should display hamburger icon when sidebar is closed', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    const hamburgerButton = page.locator('button[aria-label="サイドバーを開く"]');
    await expect(hamburgerButton).toBeVisible();
    
    // Check for hamburger menu icon (three horizontal lines)
    const hamburgerIcon = hamburgerButton.locator('path[d="M4 6h16M4 12h16M4 18h16"]');
    await expect(hamburgerIcon).toBeVisible();
  });

  test('should display close icon when sidebar is open', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Open sidebar first
    const hamburgerButton = page.locator('button[aria-label*="サイドバーを"]').first();
    await hamburgerButton.click();
    
    // Check for close icon (X)
    const closeIcon = hamburgerButton.locator('path[d="M6 18L18 6M6 6l12 12"]');
    await expect(closeIcon).toBeVisible();
  });

  test('should show overlay when sidebar is open on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Open sidebar
    const hamburgerButton = page.locator('button[aria-label*="サイドバーを"]').first();
    await hamburgerButton.click();
    
    // Check overlay is visible
    const overlay = page.locator('.fixed.inset-0.z-40.bg-black.bg-opacity-50.lg\\:hidden');
    await expect(overlay).toBeVisible();
  });

  test('should close sidebar when clicking overlay', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Open sidebar
    const hamburgerButton = page.locator('button[aria-label*="サイドバーを"]').first();
    await hamburgerButton.click();
    
    // Click overlay to close
    const overlay = page.locator('.fixed.inset-0.z-40.bg-black.bg-opacity-50.lg\\:hidden');
    await overlay.click();
    
    // Sidebar should be closed (hamburger button should show "開く")
    await expect(page.locator('button[aria-label="サイドバーを開く"]')).toBeVisible();
  });

  test('should select a chat room and update header', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Click on a chat room in the sidebar
    await page.click('text=一般チャット');
    
    // Check that header shows the selected room name
    await expect(page.locator('h2')).toContainText('一般チャット');
    
    // Check that group chat info is displayed
    await expect(page.locator('text=15人のメンバー')).toBeVisible();
    await expect(page.locator('text=5人オンライン')).toBeVisible();
  });

  test('should select direct message and update header accordingly', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Click on a direct message in the sidebar
    await page.click('text=山田太郎');
    
    // Check that header shows the direct message contact name
    await expect(page.locator('h2')).toContainText('山田太郎');
    
    // Check that it shows online status for direct message (not group info)
    await expect(page.locator('text=オンライン')).toBeVisible();
    await expect(page.locator('text=人のメンバー')).not.toBeVisible();
  });

  test('should enable action buttons when room is selected', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Initially, action buttons should be disabled
    const voiceButton = page.locator('button[title="音声通話"]');
    const videoButton = page.locator('button[title="ビデオ通話"]');
    const settingsButton = page.locator('button[title="ルーム設定"]');
    
    await expect(voiceButton).toBeDisabled();
    await expect(videoButton).toBeDisabled();
    await expect(settingsButton).toBeDisabled();
    
    // Select a room
    await page.click('text=一般チャット');
    
    // Action buttons should now be enabled
    await expect(voiceButton).toBeEnabled();
    await expect(videoButton).toBeEnabled();
    await expect(settingsButton).toBeEnabled();
  });

  test('should trigger action button handlers', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Select a room first
    await page.click('text=一般チャット');
    
    // Set up dialog handlers for alerts
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('alert');
      await dialog.accept();
    });
    
    // Test voice call button
    await page.click('button[title="音声通話"]');
    
    // Test video call button
    await page.click('button[title="ビデオ通話"]');
    
    // Test settings button
    await page.click('button[title="ルーム設定"]');
  });

  test('should display appropriate content when no room is selected', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Check default content when no room is selected
    await expect(page.locator('h3')).toContainText('チャットルームを選択してください');
    await expect(page.locator('text=左のサイドバーからチャットルームを選択するか')).toBeVisible();
  });

  test('should display room-specific content when room is selected', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Select a room
    await page.click('text=一般チャット');
    
    // Check room-specific content
    await expect(page.locator('h3')).toContainText('一般チャット');
    await expect(page.locator('text=15人のメンバー')).toBeVisible();
    await expect(page.locator('text=メッセージ機能は次のフェーズで実装予定です')).toBeVisible();
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Sidebar should be visible on desktop
    const sidebar = page.locator('[data-testid="test-sidebar"]');
    await expect(sidebar).toBeVisible();
    
    // Hamburger menu should be hidden on desktop (lg:hidden)
    const hamburgerButton = page.locator('button[aria-label*="サイドバーを"]');
    // Note: lg:hidden class should hide it, but we can check if it's functionally hidden
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Hamburger menu should be visible on mobile
    await expect(hamburgerButton).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Test keyboard navigation to hamburger button
    await page.keyboard.press('Tab');
    
    // Should focus on the hamburger button
    const hamburgerButton = page.locator('button[aria-label*="サイドバーを"]');
    await expect(hamburgerButton).toBeFocused();
    
    // Press Enter to activate
    await page.keyboard.press('Enter');
    
    // Sidebar state should change
    await expect(page.locator('button[aria-label="サイドバーを閉じる"]')).toBeVisible();
  });

  test('should maintain accessibility standards', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Check that interactive elements have proper ARIA labels
    const hamburgerButton = page.locator('button[aria-label*="サイドバーを"]');
    await expect(hamburgerButton).toHaveAttribute('aria-label');
    
    // Check that buttons have proper titles
    await expect(page.locator('button[title="音声通話"]')).toBeVisible();
    await expect(page.locator('button[title="ビデオ通話"]')).toBeVisible();
    await expect(page.locator('button[title="ルーム設定"]')).toBeVisible();
    
    // Check heading hierarchy
    const mainHeading = page.locator('h2');
    await expect(mainHeading).toBeVisible();
  });

  test('should handle authentication redirect', async ({ page }) => {
    // Clear authentication
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    
    // Try to access chat page without authentication
    await page.goto('/chat');
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login');
  });
});