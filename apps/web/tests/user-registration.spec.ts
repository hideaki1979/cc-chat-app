import { test, expect } from '@playwright/test';

test.describe('ユーザー登録統合テスト', () => {
  test('新規ユーザー登録からログインまでの総合フロー', async ({ page }) => {
    await page.goto('/register');

    // 新しいテストユーザーを作成（統合フローテスト）
    const testEmail = `test-register-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'TestUserRegistration';

    // ユーザー登録実行
    await page.getByLabel('ユーザー名').fill(testName);
    await page.getByLabel('メールアドレス').fill(testEmail);
    await page.getByPlaceholder('パスワードを入力').fill(testPassword);
    await page.getByPlaceholder('パスワードを再入力').fill(testPassword);
    await page.getByRole('button', { name: 'アカウント作成' }).click();

    // 登録成功後、ダッシュボードにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    await expect(page.getByText(`ようこそ、${testName}さん！`)).toBeVisible();

    // ログアウトして再ログインテスト（作成アカウントの有効性確認）
    await page.getByRole('button', { name: 'ログアウト' }).click();
    await expect(page).toHaveURL(/.*login/);

    // 作成したアカウントでログインできることを確認
    await page.getByLabel('メールアドレス').fill(testEmail);
    await page.getByLabel('パスワード').fill(testPassword);
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText(`ようこそ、${testName}さん！`)).toBeVisible();
  });

  test('重複メール登録のエラーハンドリング（統合テスト）', async ({ page }) => {
    // 既存のテストユーザーのメールアドレスを使用
    const existingEmail = process.env.TEST_USER_EMAIL;
    if (!existingEmail) {
      throw new Error('TEST_USER_EMAIL must be set');
    }

    await page.goto('/register');

    // 重複メールでの登録試行
    await page.getByLabel('ユーザー名').fill('Duplicate Test User');
    await page.getByLabel('メールアドレス').fill(existingEmail);
    await page.getByPlaceholder('パスワードを入力').fill('TestPassword123!');
    await page.getByPlaceholder('パスワードを再入力').fill('TestPassword123!');
    await page.getByRole('button', { name: 'アカウント作成' }).click();

    // 重複メールエラーが適切にハンドリングされることを確認
    // エラーメッセージの表示を待機（バックエンドが返すエラーメッセージに合わせて修正）
    await expect(page.getByRole('alert')).toContainText(/このメールアドレスは既に使用されています|すでに登録済み|既に使用されています|exists|登録に失敗しました/, { timeout: 15000 });
  });
});