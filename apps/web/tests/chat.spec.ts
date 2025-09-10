import { test, expect } from '@playwright/test';

test.describe('チャット機能', () => {
  // test.beforeAll で初期化されるテストユーザー情報
  let TEST_USER: { email: string; password: string; name: string };

  test.beforeAll(() => {
    // globalSetupで登録されたテストユーザー情報を使用
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
    
    // ログインフォームが表示されるまで待機
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();

    // ダッシュボードページにリダイレクトされるのを待つ
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    
    // チャットページへ移動
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/);
    
    // 認証初期化が完了し、UIが表示されるのを待つ
    await page.waitForFunction(() => {
      const loadingText = document.querySelector('p');
      return !loadingText || !loadingText.textContent?.includes('ユーザー情報を読み込み中');
    }, { timeout: 15000 });
    
    // サイドバーが表示されることを確認（h1要素のみ）
    await expect(page.getByRole('heading', { name: 'CC Chat' })).toBeVisible({ timeout: 15000 });
    
    // さらに安定性のため少し待機
    await page.waitForTimeout(1000);
  });





  test('認証済みユーザーがチャット機能にアクセスできる（総合テスト）', async ({ page }) => {
    // チャットページへの正常アクセスを確認
    await expect(page).toHaveURL(/.*chat/);
    await expect(page.getByRole('heading', { name: 'CC Chat' })).toBeVisible();
  });

  test('チャットページからログアウトできる（総合テスト）', async ({ page }) => {
    // ログアウト機能の総合テスト
    const logoutButton = page.getByTitle('ログアウト');
    await logoutButton.click();

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/);

    // ログアウト後に保護されたルートにアクセスできないことを確認
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*login/);
  });
});