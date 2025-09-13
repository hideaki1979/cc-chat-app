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

test.describe('チャットレイアウト統合ワークフロー', () => {
  test.beforeEach(async ({ page }) => {
    // ログインして認証状態を確立
    await page.goto('/login');
    await expect(page.getByLabel('メールアドレス')).toBeVisible();

    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });

    // 認証状態が完全に確立されるまで待機（ダッシュボードでユーザー名が表示されるまで）
    await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible({ timeout: 10000 });

    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/);
  });

  test('デスクトップとモバイルでの基本的な操作ワークフロー', async ({ page }) => {
    // デスクトップビューでの操作確認
    await page.setViewportSize({ width: 1280, height: 800 });

    // チャットページが正常にロードされることを確認
    await expect(page).toHaveURL(/.*chat/);

    // モバイルビューの場合はサイドバーを開く
    const viewport = page.viewportSize();
    if (viewport && viewport.width <= 768) {
      const sidebarToggle = page.getByRole('button', { name: 'サイドバーを開く' });
      if (await sidebarToggle.isVisible()) {
        await sidebarToggle.click();
      }
    }

    // サイドバーが表示されることを確認
    await expect(page.locator('[data-testid="test-sidebar"]')).toBeVisible({ timeout: 10000 });

    // 基本的なナビゲーション要素が表示されることを確認
    await expect(page.locator('[data-testid="test-sidebar"] button').filter({ hasText: 'ルーム' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="test-sidebar"] button').filter({ hasText: 'DM' })).toBeVisible();

    // モバイルビューに切り替えて基本操作を確認
    await page.setViewportSize({ width: 375, height: 667 });

    // モバイルビューではサイドバーを再度開く必要がある
    const mobileSidebarToggle = page.getByRole('button', { name: 'サイドバーを開く' });
    if (await mobileSidebarToggle.isVisible()) {
      await mobileSidebarToggle.click();
    }

    // モバイルビューでも基本機能にアクセスできることを確認
    await expect(page.locator('[data-testid="test-sidebar"] button').filter({ hasText: 'ルーム' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="test-sidebar"] button').filter({ hasText: 'DM' })).toBeVisible();
  });

  test('ユーザープロファイル表示と基本操作ワークフロー', async ({ page }) => {
    // チャットページにアクセス
    await expect(page).toHaveURL(/.*chat/);

    // ユーザー情報がサイドバーに表示されることを確認
    // （具体的な要素は実装に依存するため、存在確認のみ）
    const userInfoArea = page.locator('[data-testid="test-sidebar"]');
    await expect(userInfoArea).toBeVisible({ timeout: 10000 });

    // ログアウトボタンが利用可能であることを確認
    await expect(page.getByTestId('logout-button')).toBeVisible();
  });

  test('未認証ユーザーの適切なリダイレクト処理ワークフロー', async ({ page, context }) => {
    // 認証情報をクリアして未認証状態をシミュレート
    await context.clearCookies();

    // 保護されたチャットページに直接アクセス
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });

    // ログインページの必須要素が表示されることを確認
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('パスワード')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
  });

  test('チャット画面での基本的なナビゲーションワークフロー', async ({ page }) => {
    // チャットページでの基本操作確認
    await expect(page).toHaveURL(/.*chat/);

    // ダッシュボードに戻るナビゲーションが可能であることを確認
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible({ timeout: 10000 });

    // チャットページに戻ることができることを確認
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/);

    // モバイルビューの場合はサイドバーを開く
    const finalViewport = page.viewportSize();
    if (finalViewport && finalViewport.width <= 768) {
      const finalSidebarToggle = page.getByRole('button', { name: 'サイドバーを開く' });
      if (await finalSidebarToggle.isVisible()) {
        await finalSidebarToggle.click();
      }
    }

    // 基本的な操作ボタンが再度利用可能であることを確認
    await expect(page.locator('[data-testid="test-sidebar"] button').filter({ hasText: 'ルーム' })).toBeVisible({ timeout: 10000 });
  });
});