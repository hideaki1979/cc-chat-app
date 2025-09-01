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
    // 各テストの前にCookieとlocalStorageをクリアして独立性を保つ
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
  });

  test('should redirect unauthenticated users from protected routes to /login', async ({ page }) => {
    await page.goto('/chat');
    // /loginにリダイレクトされ、リダイレクト元の情報がクエリパラメータに含まれることを確認
    await expect(page).toHaveURL(/\/login\?redirect=%2Fchat/);
  });

  test('should show validation errors for empty login form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page.getByText('メールアドレスは必須です')).toBeVisible();
    await expect(page.getByText('パスワードは必須です')).toBeVisible();
  });

  test('should show error for incorrect login credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill('wrong-password');
    await page.getByRole('button', { name: 'ログイン' }).click();

    // APIからのエラーメッセージが表示されることを確認
    await expect(page.getByRole('alert')).toContainText(/メールアドレスまたはパスワードが正しくありません/);
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
});