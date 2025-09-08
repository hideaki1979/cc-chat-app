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

  test('チャット画面の基本レイアウト表示', async ({ page }) => {
    // 初期URLが/chatであることを確認
    await expect(page).toHaveURL(/.*chat/);
    
    // チャットページが完全に読み込まれるまで待機（ログイン画面が表示されなくなるまで）
    // ログイン画面の要素が消えるまで待つ
    await page.waitForFunction(() => {
      const loginHeading = document.querySelector('h2');
      return !loginHeading || !loginHeading.textContent?.includes('アカウントにログイン');
    }, { timeout: 10000 });
    
    // チャットアプリのタイトル要素が出現するまで待機
    await expect(page.getByRole('heading', { name: 'CC Chat' })).toBeVisible({ timeout: 5000 });
    
    // ページタイトルを確認
    await expect(page).toHaveTitle(/CC Chat/);

    // サイドバーの存在確認（サイドバー内のルームボタンを特定）
    await expect(page.getByTestId('test-sidebar').getByRole('button', { name: 'ルーム' })).toBeVisible();

    // ユーザー情報の表示確認
    await expect(page.getByText(TEST_USER.name.replace(/\s+/g, ''))).toBeVisible();
    await expect(page.getByText(TEST_USER.email)).toBeVisible();

    // 初期状態でルーム選択メッセージを表示
    await expect(page.getByRole('heading', { name: 'チャットルームを選択してください' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ダッシュボードに戻る' })).toBeVisible();
  });

  test('ルーム一覧の表示（空状態）', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    
    // 空状態メッセージの確認
    await expect(page.getByText('チャットルームがありません')).toBeVisible();
    await expect(page.getByText('新規ルームを作成してチャットを開始しましょう')).toBeVisible();
  });

  test('プレースホルダー表示機能', async ({ page }) => {
    // ルームが選択されていない状態でのプレースホルダー表示確認（ヘッダーの方を特定）
    await expect(page.getByRole('heading', { name: 'チャットルームを選択してください' })).toBeVisible();
    
    // ダッシュボードへのリンクボタンの確認
    const dashboardButton = page.getByRole('button', { name: 'ダッシュボードに戻る' });
    await expect(dashboardButton).toBeVisible();
    
    // ボタンクリックで適切にリダイレクトされることを確認
    await dashboardButton.click();
    await expect(page).toHaveURL(/.*dashboard/);
  });


  test('ログアウト機能', async ({ page }) => {
    // ログアウトボタンをクリック
    const logoutButton = page.getByTitle('ログアウト');
    await logoutButton.click();

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/);

    // ログアウト後に保護されたルートにアクセスできないことを確認
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*login/);
  });
});