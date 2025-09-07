import { test, expect } from '@playwright/test';

test.describe('TASK-003: ユーザー登録機能の検証', () => {
  test('should register new user successfully with refactored handler', async ({ page }) => {
    await page.goto('/register');
    
    // 新しいテストユーザーを作成（サービス層の分割された機能をテスト）
    const testEmail = `test-register-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'TestUserRegistration';
    
    await page.getByLabel('ユーザー名').fill(testName);
    await page.getByLabel('メールアドレス').fill(testEmail);
    await page.getByPlaceholder('パスワードを入力').fill(testPassword);
    await page.getByPlaceholder('パスワードを再入力').fill(testPassword);
    await page.getByRole('button', { name: 'アカウント作成' }).click();
    
    // 登録成功後、ダッシュボードにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    
    // 作成されたユーザー情報が表示されることを確認（ダッシュボードでの表示）
    await expect(page.getByText(`ようこそ、${testName}さん！`)).toBeVisible();
    
    // ログアウト
    await page.getByTitle('ログアウト').click();
    await expect(page).toHaveURL(/.*login/);
    
    // 作成したアカウントでログインできることを確認（Login機能の分割検証）
    await page.getByLabel('メールアドレス').fill(testEmail);
    await page.getByLabel('パスワード').fill(testPassword);
    await page.getByRole('button', { name: 'ログイン' }).click();
    
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText(`ようこそ、${testName}さん！`)).toBeVisible();
  });

  test('should show validation errors for invalid registration data', async ({ page }) => {
    await page.goto('/register');
    
    // 無効なデータで登録を試行
    await page.getByLabel('ユーザー名').fill('');
    await page.getByLabel('メールアドレス').fill('invalid-email');
    await page.getByPlaceholder('パスワードを入力').fill('123');
    await page.getByRole('button', { name: 'アカウント作成' }).click();
    
    // バリデーションエラーが表示されることを確認
    await expect(page.getByText('ユーザー名は必須です')).toBeVisible();
    await expect(page.getByText('有効なメールアドレスを入力してください')).toBeVisible();
    await expect(page.getByText('パスワードは8文字以上である必要があります')).toBeVisible();
  });

  test('should handle duplicate email registration gracefully', async ({ page }) => {
    // 既存のテストユーザーのメールアドレスを使用
    const existingEmail = process.env.TEST_USER_EMAIL;
    if (!existingEmail) {
      throw new Error('TEST_USER_EMAIL must be set');
    }
    
    await page.goto('/register');
    
    await page.getByLabel('ユーザー名').fill('Duplicate Test User');
    await page.getByLabel('メールアドレス').fill(existingEmail);
    await page.getByPlaceholder('パスワードを入力').fill('TestPassword123!');
    await page.getByRole('button', { name: 'アカウント作成' }).click();
    
    // 重複メールエラーが表示されることを確認（分割されたサービス層で適切にハンドリング）
    await expect(page.getByRole('alert')).toContainText(/すでに登録済み|既に使用されています|exists/);
  });

  test('should validate password strength requirements', async ({ page }) => {
    await page.goto('/register');
    
    const testEmail = `test-password-${Date.now()}@example.com`;
    
    // 弱いパスワードでテスト
    await page.getByLabel('ユーザー名').fill('Test User');
    await page.getByLabel('メールアドレス').fill(testEmail);
    await page.getByPlaceholder('パスワードを入力').fill('weak');
    await page.getByRole('button', { name: 'アカウント作成' }).click();
    
    // パスワード強度エラーが表示されることを確認
    await expect(page.getByText(/パスワードは8文字以上|強度が不足/)).toBeVisible();
  });

  test('should maintain form state during validation errors', async ({ page }) => {
    await page.goto('/register');
    
    const testName = 'FormStateTestUser';
    const testEmail = `test-form-state-${Date.now()}@example.com`;
    
    // 正しいデータを一部入力し、一部を無効にする
    await page.getByLabel('ユーザー名').fill(testName);
    await page.getByLabel('メールアドレス').fill(testEmail);
    await page.getByPlaceholder('パスワードを入力').fill('weak'); // 無効なパスワード
    await page.getByPlaceholder('パスワードを再入力').fill('weak');
    await page.getByRole('button', { name: 'アカウント作成' }).click();
    
    // バリデーションエラー後も、有効な入力値が保持されていることを確認
    await expect(page.getByLabel('ユーザー名')).toHaveValue(testName);
    await expect(page.getByLabel('メールアドレス')).toHaveValue(testEmail);
    
    // パスワードを修正して再送信
    await page.getByPlaceholder('パスワードを入力').fill('StrongPassword123!');
    await page.getByPlaceholder('パスワードを再入力').fill('StrongPassword123!');
    await page.getByRole('button', { name: 'アカウント作成' }).click();
    
    // 成功することを確認
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText(`ようこそ、${testName}さん！`)).toBeVisible();
  });
});