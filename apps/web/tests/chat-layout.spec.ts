import { test, expect } from '@playwright/test';

let TEST_USER: { email: string; password: string };

test.beforeAll(() => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set by globalSetup');
  }
  TEST_USER = { email, password };
});

test.describe('チャットレイアウト統合テスト', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // ログインして認証状態を確立
    await page.goto('/login');
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });

    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/);
    
    // UIが完全にロードされるまで待機
    await page.waitForFunction(() => {
      const loadingText = document.querySelector('p');
      return !loadingText || !loadingText.textContent?.includes('ユーザー情報を読み込み中');
    }, { timeout: 15000 });
    
    await expect(page.getByRole('heading', { name: 'CC Chat' })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test('デスクトップ・モバイル対応レスポンシブレイアウト（総合テスト）', async ({ page }) => {
    // デスクトップビュー確認
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="test-sidebar"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CC Chat' })).toBeVisible();

    // モバイルビューに切り替え
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // モバイルでは初期状態でサイドバーが非表示、ハンバーガーメニューが表示
    await expect(page.locator('[data-testid="test-sidebar"]')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[aria-label*="サイドバーを"]')).toBeVisible({ timeout: 10000 });
    
    // ハンバーガーメニューでサイドバー開閉操作
    const hamburgerButton = page.locator('button[aria-label*="サイドバーを"]').first();
    await hamburgerButton.click();
    await expect(page.locator('[data-testid="test-sidebar"]')).toBeVisible();
    
    // オーバーレイクリックで閉じる
    await page.getByTestId('sidebar-overlay').click();
    await expect(page.locator('[data-testid="test-sidebar"]')).not.toBeVisible();
  });

  test('未認証ユーザーの適切なリダイレクト処理（統合テスト）', async ({ page, context }) => {
    // 認証情報をクリアして未認証状態をシミュレート
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());

    // 保護されたチャットページに直接アクセス
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/);
  });
});