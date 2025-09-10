import { test, expect } from '@playwright/test';

test.describe('認証トークン統合テスト', () => {
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

  test('認証トークンの自動リフレッシュと期限切れ処理（総合テスト）', async ({ page, context }) => {
    // ログインして正常な認証状態を確立
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/.*dashboard/);

    // 無効なリフレッシュトークンを設定して期限切れをシミュレート
    await context.addCookies([{
      name: 'refresh_token',
      value: 'expired-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }]);

    // 保護されたページへのアクセスを試行
    await page.goto('/chat');
    
    // トークン期限切れ時はログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/);
  });
});