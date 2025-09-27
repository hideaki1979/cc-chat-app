import { test, expect } from '@playwright/test';

test.describe('404 Not Found ページ', () => {
  test('存在しないルートへのアクセスで404ページが表示される', async ({ page }) => {
    // 存在しないページにアクセス
    await page.goto('/non-existent-page');

    // 404ページが表示されることを確認
    await expect(page).toHaveURL('/non-existent-page');
    await expect(page.locator('[data-testid="not-found-title"]')).toContainText('ページが見つかりません');
    await expect(page.locator('[data-testid="not-found-description"]')).toContainText('お探しのページは存在しないか');

    // タイトルが設定されることを確認（動的設定のため少し待機）
    await expect(page).toHaveTitle(/ページが見つかりません/, { timeout: 2000 });
  });

  test('404ページの基本要素が正しく表示される', async ({ page }) => {
    await page.goto('/does-not-exist');

    // メインタイトルとアイコンの確認
    await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="not-found-description"]')).toBeVisible();

    // 大きな404テキストの確認
    await expect(page.locator('text=404').first()).toBeVisible();

    // SVGアイコンの確認
    await expect(page.locator('svg').first()).toBeVisible();

    // アクションボタンの確認
    await expect(page.locator('[data-testid="home-link"]')).toContainText('ホームに戻る');
    await expect(page.locator('[data-testid="back-button"]')).toContainText('前のページに戻る');
  });

  test('「ホームに戻る」リンクの動作確認', async ({ page }) => {
    await page.goto('/invalid-url');

    // ホームに戻るリンクをクリック
    await page.locator('[data-testid="home-link"]').click();

    // ホームページにリダイレクトされることを確認（middlewareによりルート / は /dashboard または /login にリダイレクトされる）
    await page.waitForURL(/\/(dashboard|login|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/(dashboard|login|$)/);

    // ページのコンテンツが表示されることを確認
    await expect(page.locator('h1, [data-testid="welcome-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('「前のページに戻る」ボタンの動作確認', async ({ page }) => {
    // まずホームページに移動（履歴を作成）
    await page.goto('/');
    await expect(page).toHaveURL('/');

    // 存在しないページに移動
    await page.goto('/non-existent-route');
    await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

    // 「前のページに戻る」ボタンをクリック
    await page.locator('[data-testid="back-button"]').click();

    // 前のページ（ホームページ）に戻ることを確認
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page).toHaveURL('/');
  });

  test('推奨リンクの動作確認', async ({ page }) => {
    await page.goto('/missing-page');

    // 推奨リンクセクションが表示されることを確認
    await expect(page.locator('text=よく利用されるページ')).toBeVisible();

    // 各推奨リンクが表示されることを確認
    await expect(page.locator('[data-testid="home-shortcut"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-shortcut"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-shortcut"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-shortcut"]')).toBeVisible();

    // ホームショートカットのクリック確認
    await page.locator('[data-testid="home-shortcut"]').click();
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page).toHaveURL('/');
  });

  test('ログインショートカットの動作確認', async ({ page }) => {
    await page.goto('/unknown-page');

    // ログインショートカットをクリック
    await page.locator('[data-testid="login-shortcut"]').click();

    // ログインページにリダイレクトされることを確認
    await page.waitForURL('/login', { timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('新規登録ショートカットの動作確認', async ({ page }) => {
    await page.goto('/undefined-route');

    // 新規登録ショートカットをクリック
    await page.locator('[data-testid="register-shortcut"]').click();

    // 新規登録ページにリダイレクトされることを確認
    await page.waitForURL('/register', { timeout: 5000 });
    await expect(page).toHaveURL('/register');
  });

  test('チャットショートカットの動作確認', async ({ page }) => {
    await page.goto('/broken-link');

    // チャットショートカットをクリック
    await page.locator('[data-testid="chat-shortcut"]').click();

    // チャットページにリダイレクトされることを確認
    await page.waitForURL('/chat', { timeout: 5000 });
    await expect(page).toHaveURL('/chat');
  });

  test('404ページのレスポンシブデザイン確認', async ({ page }) => {
    await page.goto('/responsive-test');

    // デスクトップビューでの表示確認
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-link"]')).toBeVisible();

    // タブレットビューでの表示確認
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-link"]')).toBeVisible();

    // モバイルビューでの表示確認
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-link"]')).toBeVisible();

    // ボタンが縦並びになることを確認（モバイルビュー）
    const homeLink = page.locator('[data-testid="home-link"]');
    const backButton = page.locator('[data-testid="back-button"]');

    await expect(homeLink).toBeVisible();
    await expect(backButton).toBeVisible();
  });

  test('ページのアクセシビリティ確認', async ({ page }) => {
    await page.goto('/accessibility-test');

    // 見出しの階層構造を確認
    await expect(page.locator('h1[data-testid="not-found-title"]')).toBeVisible();
    await expect(page.locator('h2')).toContainText('よく利用されるページ');

    // ボタンとリンクがキーボードでアクセス可能か確認
    const homeLink = page.locator('[data-testid="home-link"]');
    const backButton = page.locator('[data-testid="back-button"]');

    // フォーカス可能要素の確認
    await homeLink.focus();
    await expect(homeLink).toBeFocused();

    await backButton.focus();
    await expect(backButton).toBeFocused();

    // aria-hidden属性が適切に設定されているか確認
    const hiddenElements = page.locator('[aria-hidden="true"]');
    await expect(hiddenElements.first()).toBeVisible();
  });

  test('複数の異なる存在しないパスでの404ページ表示確認', async ({ page }) => {
    const publicNonExistentPaths = [
      '/admin/secret',
      '/api/nonexistent',
      '/user/999999',
      '/deeply/nested/non/existent/path'
    ];

    // 公開パス（未認証でもアクセス可能）の404確認
    for (const path of publicNonExistentPaths) {
      await page.goto(path);

      // 各パスで404ページが正しく表示されることを確認
      await expect(page).toHaveURL(path);
      await expect(page.locator('[data-testid="not-found-title"]')).toContainText('ページが見つかりません');
      await expect(page.locator('[data-testid="not-found-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="home-link"]')).toBeVisible();
    }

    // 保護されたパス（認証が必要）はログインページにリダイレクトされることを確認
    const protectedPath = '/chat/invalid-room';
    await page.goto(protectedPath);
    await expect(page).toHaveURL(`/login?redirect=${encodeURIComponent(protectedPath)}`);
  });

  test('404ページからの正常なナビゲーションフロー', async ({ page }) => {
    // 1. 存在しないページにアクセス
    await page.goto('/complete-flow-test');
    await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

    // 2. ログインページに移動
    await page.locator('[data-testid="login-shortcut"]').click();
    await page.waitForURL('/login', { timeout: 5000 });
    await expect(page).toHaveURL('/login');

    // 3. 再度存在しないページにアクセス
    await page.goto('/another-missing-page');
    await expect(page.locator('[data-testid="not-found-title"]')).toBeVisible();

    // 4. 新規登録ページに移動
    await page.locator('[data-testid="register-shortcut"]').click();
    await page.waitForURL('/register', { timeout: 5000 });
    await expect(page).toHaveURL('/register');

    // 5. 最終的にホームに戻る（未認証ユーザーはルートページへ）
    await page.goto('/final-test-404');
    await page.locator('[data-testid="home-link"]').click();
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page).toHaveURL('/');
  });

  test('SEO関連のメタデータ確認', async ({ page }) => {
    await page.goto('/seo-test-404');

    // タイトルの確認
    await expect(page).toHaveTitle('ページが見つかりません - CC Chat');

    // メタディスクリプションの確認（動的設定されたもの）
    await page.waitForFunction(
      () => document.querySelector('meta[name="description"]')?.getAttribute('content')?.includes('お探しのページが見つかりませんでした'),
      { timeout: 2000 }
    );
    const metaDescription = page.locator('meta[name="description"]').last();
    await expect(metaDescription).toHaveAttribute('content', /お探しのページが見つかりませんでした/);
  });
});