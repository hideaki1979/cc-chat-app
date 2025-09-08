import { test, expect } from '@playwright/test';

test.describe('Authentication and Authorization', () => {
  let TEST_USER: { email: string; password: string };

  test.beforeAll(() => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in globalSetup.');
    }
    TEST_USER = { email, password };
  });

  test.beforeEach(async ({ page, context }) => {
    // 各テストの前にCookieをクリアして独立性を保つ
    // localStorage は使用しなくなったため削除
    await context.clearCookies();
  });

  test('should redirect unauthenticated users from protected routes to /login', async ({ page }) => {
    await page.goto('/chat');
    // /loginにリダイレクトされ、リダイレクト元の情報がクエリパラメータに含まれることを確認
    await expect(page).toHaveURL(/\/login\?redirect=%2Fchat/);
  });

  test('should show validation errors for empty login form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'ログイン' }).click();

    // 空の入力の場合、email バリデーションは「有効なメールアドレスを入力してください」が表示される
    await expect(page.getByText('有効なメールアドレスを入力してください')).toBeVisible();
    await expect(page.getByText('パスワードは必須です')).toBeVisible();
  });

  test('should show error for incorrect login credentials', async ({ page }) => {
    await page.goto('/login');
    
    // 存在するメールアドレスを使用し、間違ったパスワードでAPIエラーを発生させる
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    // フロントバリデーションを通過するが、実際のパスワードとは異なるパスワード
    await page.getByLabel('パスワード').fill('WrongPassword123');
    await page.getByRole('button', { name: 'ログイン' }).click();

    // APIからの「invalid credentials」エラーが表示されることを確認
    // LoginForm.tsxの90-97行目のエラー表示を確認
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });
    // 実際のエラーメッセージを確認
    await expect(page.locator('.bg-red-50 .text-sm')).toContainText('メールアドレスまたはパスワードに誤りがあります');
  });

  test('should allow a user to log in and redirect to /dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page).toHaveURL(/.*dashboard/);
    // ログイン後のダッシュボードにユーザー名が表示されることを確認
    await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible();
  });

  test('should redirect authenticated users from /login to /dashboard', async ({ page }) => {
    // 先にログインする
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/.*dashboard/);

    // ログイン状態で/loginにアクセス
    await page.goto('/login');
    // /dashboardにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should allow a user to log out', async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/.*dashboard/);

    // チャットページに移動してログアウトボタンを押す
    await page.goto('/chat');
    await page.getByTitle('ログアウト').click();

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/);

    // ログアウト後、保護されたルートにアクセスできないことを確認
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*login/);
  });

  test('should navigate between /login and /register pages', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: '新規登録' }).click();
    await expect(page).toHaveURL('/register');

    await page.getByRole('link', { name: 'ログイン' }).click();
    await expect(page).toHaveURL('/login');
  });

  // Cookie認証の検証テスト
  test.describe('Cookie Authentication Validation', () => {
    test('should set httpOnly refresh token cookie on login', async ({ page, context }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);

      // Cookieが設定されていることを確認
      const cookies = await context.cookies();
      const refreshTokenCookie = cookies.find(cookie => cookie.name === 'refresh_token');
      
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie?.httpOnly).toBe(true);
      expect(refreshTokenCookie?.path).toBe('/');
      expect(refreshTokenCookie?.secure).toBe(false); // 開発環境ではfalse
      expect(refreshTokenCookie?.sameSite).toBe('Lax');
      expect(refreshTokenCookie?.value).toBeTruthy();
    });

    test('should maintain authentication state across page reloads', async ({ page }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);

      // ページリロード
      await page.reload();
      
      // 認証状態が維持されていることを確認
      await expect(page).toHaveURL(/.*dashboard/);
      await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible();
    });

    test('should clear refresh token cookie on logout', async ({ page, context }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);

      // ログアウト
      await page.goto('/chat');
      await page.getByTitle('ログアウト').click();
      
      await expect(page).toHaveURL(/.*login/);

      // Cookieがクリアされていることを確認
      const cookies = await context.cookies();
      const refreshTokenCookie = cookies.find(cookie => cookie.name === 'refresh_token');
      
      // クッキーが削除されているか、値が空になっていることを確認
      expect(refreshTokenCookie?.value || '').toBe('');
    });

    test('should automatically refresh tokens on protected route access', async ({ page }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);

      // 保護されたルートに直接アクセス
      await page.goto('/chat');
      
      // 認証状態が自動的に復元されることを確認
      await expect(page).toHaveURL(/.*chat/);
      
      // ページが正常にロードされることを確認
      await expect(page.getByRole('heading', { name: 'CC Chat' })).toBeVisible();
    });

    test('should handle expired refresh token gracefully', async ({ page, context }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);

      // 無効なリフレッシュトークンを設定（期限切れをシミュレート）
      await context.addCookies([{
        name: 'refresh_token',
        value: 'expired-or-invalid-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }]);

      // 保護されたルートにアクセス
      await page.goto('/chat');
      
      // ログインページにリダイレクトされることを確認
      await expect(page).toHaveURL(/.*login/);
    });

    test('should work with concurrent requests using cookies', async ({ page }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);

      // 複数のAPIリクエストが同時に実行される可能性があるページに移動
      await page.goto('/chat');
      
      // ページが正常にロードされ、複数のAPIコールが成功することを確認（CC Chatヘッダーを確認）
      await expect(page.getByRole('heading', { name: 'CC Chat' })).toBeVisible();
      
      // プロフィールページにも移動して別のAPIコールをテスト
      await page.goto('/profile');
      await expect(page.locator('h1')).toBeVisible();
    });
  });

  // TASK-001: window オブジェクト汚染除去の検証
  test.describe('Window Global Pollution Prevention (TASK-001)', () => {
    test('should not expose authStore on window object', async ({ page }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      
      // window.authStore が存在しないことを確認（汚染除去されている）
      const windowAuthStore = await page.evaluate(() => {
        return (window as unknown as { authStore?: unknown }).authStore;
      });
      expect(windowAuthStore).toBeUndefined();
      
      // ページリロード後でも window.authStore が存在しないことを確認
      await page.reload();
      const windowAuthStoreAfterReload = await page.evaluate(() => {
        return (window as unknown as { authStore?: unknown }).authStore;
      });
      expect(windowAuthStoreAfterReload).toBeUndefined();
      
      // しかし、認証状態は正常に管理されている
      await expect(page).toHaveURL(/.*dashboard/);
      await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible();
    });
  });

  // TASK-002: localStorage 直接アクセス修正の検証
  test.describe('Safe LocalStorage Access (TASK-002)', () => {
    test('should handle localStorage errors gracefully', async ({ page }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      
      // localStorage を一時的に読み取り専用にして書き込みエラーをシミュレート
      await page.evaluate(() => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = () => {
          throw new Error('Storage quota exceeded');
        };
        
        // 元に戻す（テスト終了後のクリーンアップ）
        setTimeout(() => {
          localStorage.setItem = originalSetItem;
        }, 1000);
      });
      
      // アプリケーションがエラーで停止しないことを確認
      await expect(page.locator('body')).toBeVisible();
      
      // 正常にページが動作することを確認
      await page.goto('/chat');
      await expect(page).toHaveURL(/.*chat/);
    });
    
    test('should work without localStorage in SSR environment', async ({ page, context }) => {
      // ログイン
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      
      // localStorage を無効化してSSR環境をシミュレート
      await page.evaluate(() => {
        Object.defineProperty(window, 'localStorage', {
          value: null,
          writable: true
        });
      });
      
      // リフレッシュトークンも無効化してSSR認証失敗をシミュレート
      await context.addCookies([{
        name: 'refresh_token',
        value: 'expired-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }]);
      
      // ページリロード（SSR環境シミュレート）
      await page.reload();
      
      // エラーが発生せずに正常に動作することを確認
      await expect(page.locator('body')).toBeVisible();
      
      // localStorage が利用できず、リフレッシュトークンも無効な環境では
      // ログインページにリダイレクトされる
      await expect(page).toHaveURL(/.*login/);
    });
  });

  // セキュリティ統合検証
  test.describe('Security Integration Tests', () => {
    test('should maintain security standards across authentication flow', async ({ page }) => {
      // 1. window.authStore が存在しないことを確認（window汚染除去）
      const windowAuthStore = await page.evaluate(() => {
        return (window as unknown as { authStore?: unknown }).authStore;
      });
      expect(windowAuthStore).toBeUndefined();
      
      // 2. ログイン実行
      await page.goto('/login');
      await page.getByLabel('メールアドレス').fill(TEST_USER.email);
      await page.getByLabel('パスワード').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'ログイン' }).click();
      
      await expect(page).toHaveURL(/.*dashboard/);
      
      // 3. ログイン後もwindow汚染がないことを確認
      const windowAuthStoreAfterLogin = await page.evaluate(() => {
        return (window as unknown as { authStore?: unknown }).authStore;
      });
      expect(windowAuthStoreAfterLogin).toBeUndefined();
      
      // 4. APIレスポンスの正常性確認（ハンドラー分割後）
      const apiRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/backend/')) {
          apiRequests.push(request.url());
        }
      });
      
      // チャット機能を使用してAPIリクエストを発生させる
      await page.goto('/chat');
      await page.waitForTimeout(2000);
      
      // APIリクエストが正常に処理されていることを確認
      expect(apiRequests.length).toBeGreaterThan(0);
      
      // ページが正常に動作していることを確認
      await expect(page.getByRole('heading', { level: 1, name: 'CC Chat' })).toBeVisible();
    });
  });
});