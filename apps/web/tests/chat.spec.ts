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
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();

    // ダッシュボードページにリダイレクトされるのを待つ
    await expect(page).toHaveURL(/.*dashboard/);
    
    // ログイン成功後のCookie確認（デバッグ）
    const cookies = await page.context().cookies();
    console.log('Cookies after login:', cookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`));

    // チャットページへ移動
    await page.goto('/chat');
    
    // チャットページでの認証処理完了を待機
    await page.waitForTimeout(1000);
    
    // URLが維持されているか確認（リダイレクトされていないか）
    const currentUrl = page.url();
    console.log('Current URL after /chat navigation:', currentUrl);
    
    if (currentUrl.includes('/login')) {
      throw new Error('Authentication failed - redirected to login page');
    }
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
    await expect(page.getByText('CC Chat')).toBeVisible({ timeout: 5000 });
    
    // ページタイトルを確認
    await expect(page).toHaveTitle(/CC Chat/);

    // サイドバーの存在確認
    await expect(page.getByRole('button', { name: 'ルーム' })).toBeVisible();

    // ユーザー情報の表示確認
    await expect(page.getByText(TEST_USER.name)).toBeVisible();
    await expect(page.getByText(TEST_USER.email)).toBeVisible();

    // 初期状態でルーム選択メッセージを表示
    await expect(page.getByText('チャットルームを選択してください')).toBeVisible();
    await expect(page.getByText('ダッシュボードに戻る')).toBeVisible();
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
    // ルームが選択されていない状態でのプレースホルダー表示確認
    await expect(page.getByText('チャットルームを選択してください')).toBeVisible();
    
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