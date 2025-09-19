import { test, expect } from '@playwright/test';

test.describe('チャット機能統合ワークフロー', () => {
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
  test.beforeEach(async ({ page, context }) => {
    // ログイン処理
    await page.goto('/login');

    // ログインフォームが表示されるまで待機
    await expect(page.getByLabel('メールアドレス')).toBeVisible();

    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();

    // ダッシュボードページにリダイレクトされるのを待つ
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });

    // 認証状態が完全に確立されるまで待機（ダッシュボードでユーザー名が表示されるまで）
    await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible({ timeout: 15000 });

    // 診断: ログイン成功後のクッキー確認（テスト完了後の情報として記録）
    const cookies = await context.cookies();
    const refreshToken = cookies.find((c) => c.name === 'refresh_token');
    const accessToken = cookies.find((c) => c.name === 'access_token');

    // 値は記憶しない（name/domain/json）
    const safeCookies = cookies.map(({name, domain, path, expires, httpOnly, secure, sameSite}) => ({
      name, domain, path, expires, httpOnly, secure, sameSite
    }));
    await test.info().attach('cookies-after-login', {
      body: JSON.stringify({
        refresh_token_present: Boolean(refreshToken),
        access_token_present: Boolean(accessToken),
        cookies_meta:safeCookies,
      }, null, 2),
      contentType: 'application/json',
    });
  });

  test('チャットページの基本的な表示と機能確認', async ({ page }) => {
    // 1. チャットページへ移動
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/);

    // 2. プレースホルダーメッセージが表示されることを確認（元の安定版のまま）
    await expect(page.getByTestId('welcome-message')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('左のサイドバーからチャットルームを選択するか、')).toBeVisible();
    await expect(page.getByText('新しいルームを作成してチャットを開始しましょう')).toBeVisible();

    // 3. モバイルビューの場合はサイドバーを開く
    const viewport = page.viewportSize();
    if (viewport && viewport.width <= 768) {
      // モバイルビューの場合、サイドバーを開く
      const sidebarToggle = page.getByRole('button', { name: 'サイドバーを開く' });
      if (await sidebarToggle.isVisible()) {
        await sidebarToggle.click();
        // クローズボタンの表示のみ待機（以前に通っていた安定版へ戻す）
        await expect(page.getByRole('button', { name: 'サイドバーを閉じる' })).toBeVisible();
      }
    }

    // 4. サイドバー内のルーム作成ボタンが表示されることを確認
    await expect(page.locator('[data-testid="test-sidebar"] button').filter({ hasText: 'ルーム' })).toBeVisible();

    // 5. DMボタンが表示されることを確認  
    await expect(page.locator('[data-testid="test-sidebar"] button').filter({ hasText: 'DM' })).toBeVisible();

    // 6. ダッシュボードに戻るボタンが表示されることを確認
    await expect(page.getByTestId('back-to-dashboard-button')).toBeVisible();

    // 7. モバイル時は「サイドバーを閉じる」ボタンで閉じる（オーバーレイのクリック遮り回避）
    if (viewport && viewport.width <= 768) {
      const closeBtn = page.getByRole('button', { name: 'サイドバーを閉じる' });
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(page.getByTestId('sidebar-overlay')).toBeHidden();
      }
    }

    // 8. ダッシュボードに戻る機能の確認
    await page.getByTestId('back-to-dashboard-button').click();
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
  });

  test('ユーザー検索モーダルの基本的な動作確認', async ({ page }) => {
    // 1. チャットページへ移動
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/);

    // 2. ビューポートに応じてサイドバーの可視性を保証
    const viewport = page.viewportSize();
    if (viewport && viewport.width <= 768) {
      const sidebarToggle = page.getByRole('button', { name: 'サイドバーを開く' });
      if (await sidebarToggle.isVisible()) {
        await sidebarToggle.click();
        await expect(page.getByRole('button', { name: 'サイドバーを閉じる' })).toBeVisible();
      }
    } else {
      await expect(page.locator('[data-testid="test-sidebar"]')).toBeVisible();
    }

    // 3. サイドバー内のDMボタンをクリック（以前の安定版へ戻す）
    const sidebar = page.locator('[data-testid="test-sidebar"]');
    // サイドバーが表示されていることを保証（モバイルはトグルボタン、デスクトップはDOM可視）
    if (viewport && viewport.width <= 768) {
      await expect(page.getByRole('button', { name: 'サイドバーを閉じる' })).toBeVisible();
    } else {
      await expect(sidebar).toBeVisible();
    }
    const dmButton = sidebar.locator('button', { hasText: 'DM' });
    await dmButton.scrollIntoViewIfNeeded();
    await expect(dmButton).toBeVisible();
    await dmButton.click({ force: true });

    // 4. ユーザー検索モーダルが開かれることを確認（見出しで確認）
    await expect(page.getByText('ユーザーを検索してDMを開始')).toBeVisible({ timeout: 10000 });

    // 5. 検索フィールドが表示されることを確認
    await expect(page.getByPlaceholder('ユーザー名またはメールアドレスで検索...')).toBeVisible();

    // 6. プレースホルダーメッセージが表示されることを確認
    await expect(page.getByText('ユーザー名またはメールアドレスを入力してください')).toBeVisible();

    // 7. モーダルを閉じる（見出しから隣接するボタンを特定）
    const closeButton = page.getByRole('heading', { name: 'ユーザーを検索してDMを開始' }).locator('xpath=../button');
    await closeButton.click();
  });

  test('ログアウトワークフロー', async ({ page }) => {
    // 1. ダッシュボードからアプリ内遷移でチャットへ（状態維持）
    await expect(page).toHaveURL(/.*dashboard/);
    await page.getByRole('button', { name: 'チャットを開始' }).click();
    await expect(page).toHaveURL(/.*chat/);

    // 2. ログアウトボタンをクリック（モバイルではサイドバーを開いてから押す）
    const viewport = page.viewportSize();
    if (viewport && viewport.width <= 768) {
      const sidebarToggle = page.getByRole('button', { name: 'サイドバーを開く' });
      if (await sidebarToggle.isVisible()) {
        await sidebarToggle.click();
        await Promise.all([
          expect(page.getByTestId('sidebar-overlay')).toBeVisible(),
          expect(page.getByRole('button', { name: 'サイドバーを閉じる' })).toBeVisible(),
        ]);
      }
    }
    const sidebar = page.locator('[data-testid="test-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    await sidebar.evaluate((el) => { el.scrollTop = 0; });
    const logoutBtn = page.getByTestId('logout-button');
    await logoutBtn.scrollIntoViewIfNeeded();
    await expect(logoutBtn).toBeVisible();
    // モバイルのクリック遮り回避：forceで押下
    await logoutBtn.click({ force: true });

    // 3. ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });

    // 4. ログアウト後に保護されたルートにアクセスできないことを確認
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*login/);
  });

  test('認証が必要なページへの直接アクセス時のリダイレクト', async ({ page, context }) => {
    // 認証情報をクリアして未認証状態をシミュレート
    await context.clearCookies();

    // 保護されたチャットページに直接アクセス
    await page.goto('/chat');

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });

    // ログインフォームが表示されることを確認
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
  });
});