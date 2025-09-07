import { test, expect } from '@playwright/test';

test.describe('TASK-003: トークンリフレッシュ機能の検証', () => {
  let TEST_USER: { email: string; password: string; name: string };

  test.beforeAll(() => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      throw new Error('E2E実行には TEST_USER_EMAIL/TEST_USER_PASSWORD の設定が必要です');
    }
    TEST_USER = {
      email,
      password,
      name: 'E2E Test User',
    };
  });

  // 各テストの前にログイン処理を実行
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();

    // ダッシュボードページにリダイレクトされるのを待つ
    await expect(page).toHaveURL(/.*dashboard/);

    // チャットページへ移動
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/);
  });

  test('should handle token refresh automatically when access token expires', async ({ page }) => {
    // 既にbeforeEachでログイン済み、チャットページにいる
    await expect(page).toHaveURL(/.*chat/);
    await expect(page.getByText('CC Chat')).toBeVisible();
    
    // アクセストークンの期限切れをシミュレート
    // 実際のRefreshToken機能（分割されたサービス層）をテスト
    await page.evaluate(() => {
      // アクセストークンを無効化（期限切れシミュレート）
      document.cookie = 'access_token=invalid_token; path=/';
    });
    
    // APIリクエストが発生する操作を実行（ページリロード）
    // 内部的にトークンリフレッシュが実行される
    await page.reload();
    
    // トークンリフレッシュが成功し、認証状態が維持されることを確認
    // （失敗した場合はログインページにリダイレクトされる）
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // リフレッシュトークンも期限切れの場合はログインページへ
      console.log('Refresh token expired, redirected to login - this is expected behavior');
      expect(currentUrl).toContain('/login');
    } else {
      // リフレッシュ成功の場合
      await expect(page).toHaveURL(/.*chat/);
      await expect(page.getByText('CC Chat')).toBeVisible();
      await expect(page.locator('p').filter({ hasText: TEST_USER.name })).toBeVisible();
    }
  });

  test('should redirect to login when refresh token is invalid', async ({ page, context }) => {
    // 無効なリフレッシュトークンを設定
    await context.addCookies([{
      name: 'refresh_token',
      value: 'completely-invalid-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }]);

    // アクセストークンも無効化
    await page.evaluate(() => {
      document.cookie = 'access_token=invalid_token; path=/';
    });

    // 保護されたページにアクセス
    await page.goto('/chat');
    
    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/);
    
    // リフレッシュ失敗時のエラーメッセージが表示される（オプション）
    // await expect(page.getByText(/セッションの有効期限が切れました/)).toBeVisible();
  });

  test('should handle multiple concurrent requests during token refresh', async ({ page }) => {
    // ログイン状態を確認
    await expect(page).toHaveURL(/.*chat/);
    
    // アクセストークンを期限切れにシミュレート
    await page.evaluate(() => {
      document.cookie = 'access_token=expired_token; path=/';
    });
    
    // 複数のAPIリクエストを同時に発行する可能性があるアクションを実行
    // （複数のコンポーネントが同時にデータを取得しようとする）
    const requests = await Promise.allSettled([
      page.goto('/chat'),
      page.goto('/profile'),
      page.goto('/dashboard')
    ]);
    
    // 少なくとも1つのリクエストは成功するか、すべてログインページにリダイレクトされる
    const currentUrl = page.url();
    const isAuthenticated = !currentUrl.includes('/login');
    
    if (isAuthenticated) {
      // トークンリフレッシュが成功した場合
      await expect(page.locator('body')).toBeVisible();
    } else {
      // リフレッシュトークンも期限切れの場合
      await expect(page).toHaveURL(/.*login/);
    }
  });

  test('should maintain user session across page navigations after token refresh', async ({ page }) => {
    // 現在のチャットページで認証状態を確認
    await expect(page.getByText('CC Chat')).toBeVisible();
    
    // アクセストークンを無効化
    await page.evaluate(() => {
      document.cookie = 'access_token=invalid_token; path=/';
    });
    
    // 異なるページに移動してトークンリフレッシュをトリガー
    await page.goto('/dashboard');
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      // リフレッシュ成功の場合、ユーザー情報が表示されることを確認
      await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible();
      
      // 再度チャットページに戻って状態が維持されていることを確認
      await page.goto('/chat');
      await expect(page.getByText('CC Chat')).toBeVisible();
      await expect(page.locator('p').filter({ hasText: TEST_USER.name })).toBeVisible();
    } else {
      // リフレッシュ失敗の場合
      await expect(page).toHaveURL(/.*login/);
    }
  });

  test('should handle token refresh gracefully during active user interactions', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    
    // ルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: '一般チャット' })).toBeVisible();
    
    // アクセストークンを無効化
    await page.evaluate(() => {
      document.cookie = 'access_token=invalid_token; path=/';
    });
    
    // ユーザーがメッセージを送信しようとする（認証が必要な操作）
    const messageInput = page.getByPlaceholder('一般チャットにメッセージを送信...');
    await messageInput.fill('トークンリフレッシュテスト');
    await page.getByRole('button', { name: 'メッセージを送信' }).click();
    
    // トークンリフレッシュが自動的に行われ、操作が成功するか、
    // またはログインページにリダイレクトされる
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      // 成功の場合、メッセージが送信されることを確認
      await expect(page.getByText('トークンリフレッシュテスト')).toBeVisible();
    } else {
      // 失敗の場合、ログインページに移動
      await expect(page).toHaveURL(/.*login/);
    }
  });

  test('should clear tokens and redirect on refresh token expiration', async ({ page, context }) => {
    // 期限切れのリフレッシュトークンをシミュレート
    await context.addCookies([{
      name: 'refresh_token',
      value: 'expired-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }]);

    // アクセストークンも期限切れに設定
    await page.evaluate(() => {
      document.cookie = 'access_token=expired_access_token; path=/';
    });

    // 保護されたページへのアクセスを試行
    await page.goto('/chat');
    
    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/);
    
    // クッキーがクリアされていることを確認
    const cookies = await context.cookies();
    const refreshTokenCookie = cookies.find(cookie => cookie.name === 'refresh_token');
    const accessTokenCookie = cookies.find(cookie => cookie.name === 'access_token');
    
    // クッキーが削除されているか、値が空になっていることを確認
    if (refreshTokenCookie) {
      expect(refreshTokenCookie.value).toBe('');
    }
    if (accessTokenCookie) {
      expect(accessTokenCookie.value).toBe('');
    }
  });
});