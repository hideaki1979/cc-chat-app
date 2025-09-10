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




});