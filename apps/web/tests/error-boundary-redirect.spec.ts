import { test, expect } from '@playwright/test';

test.describe('Error Boundary リダイレクト機能', () => {
  test.beforeEach(async ({ page }) => {
    // テスト用エラーページに移動
    await page.goto('/test-error');
    await expect(page.locator('h1')).toContainText('Error Boundary E2E テストページ');
  });

  test('正常時の表示確認', async ({ page }) => {
    // 正常状態でのコンテンツ表示を確認
    await expect(page.locator('[data-testid="normal-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="normal-content"] h3')).toContainText('正常動作中');

    // エラーが発生していないことを確認
    await expect(page.locator('[data-testid="trigger-error-button"]')).toContainText('エラーを発生させる');
    await expect(page.locator('text=現在の状態: 正常動作')).toBeVisible();
  });

  test('エラー発生からエラーページへのリダイレクト', async ({ page }) => {
    // セッションストレージをクリア（テスト前の状態をクリーンにする）
    await page.evaluate(() => {
      sessionStorage.removeItem('errorBoundaryDetails');
    });

    // エラーを発生させるボタンをクリック
    await page.locator('[data-testid="trigger-error-button"]').click();

    // Error Boundaryの一時的なメッセージが表示されることを確認
    await expect(page.locator('text=エラーが発生しました')).toBeVisible();
    await expect(page.locator('text=エラー詳細画面に移動しています...')).toBeVisible();

    // スピナーアイコンが表示されることを確認
    await expect(page.locator('.animate-spin')).toBeVisible();

    // 2秒待ってリダイレクトが発生することを確認
    await page.waitForURL('/error', { timeout: 5000 });
    await expect(page).toHaveURL('/error');

    // エラーページのタイトルが表示されることを確認
    await expect(page.locator('h1')).toContainText('アプリケーションエラーが発生しました');
  });

  test('エラーページでエラー詳細情報の表示確認', async ({ page }) => {
    // エラーページに直接アクセスする前に、まずエラー情報をセッションストレージに設定
    await page.evaluate(() => {
      const errorDetails = {
        message: 'E2E Test Error: エラーページへのリダイレクトテスト用のエラーです。',
        stack: 'Error: E2E Test Error\\n    at ErrorTriggerComponent\\n    at Component',
        timestamp: new Date().toISOString(),
        url: 'http://localhost:3003/test-error',
        userAgent: navigator.userAgent,
        componentStack: '    in ErrorTriggerComponent\\n    in ErrorBoundary'
      };
      sessionStorage.setItem('errorBoundaryDetails', JSON.stringify(errorDetails));
    });

    // エラーページに移動
    await page.goto('/error');

    // エラーページの基本構造を確認
    await expect(page.locator('h1')).toContainText('アプリケーションエラーが発生しました');
    await expect(page.locator('h2')).toContainText('エラー詳細情報');

    // エラーメッセージが表示されることを確認
    await expect(page.locator('[data-testid="error-message"]')).toContainText('E2E Test Error: エラーページへのリダイレクトテスト用のエラーです。');

    // 基本情報セクションの確認
    await expect(page.locator('text=発生日時:')).toBeVisible();
    await expect(page.locator('text=発生ページ:')).toBeVisible();

    // アクションボタンの存在確認
    await expect(page.locator('[data-testid="home-button"]')).toContainText('ホームに戻る');
    await expect(page.locator('[data-testid="reload-button"]')).toContainText('ページを再読み込み');

    // 開発環境の場合、エラーレポートダウンロードボタンも確認
    if (process.env.NODE_ENV === 'development') {
      await expect(page.locator('[data-testid="download-report-button"]')).toBeVisible();
    }
  });

  test('エラーページから「ホームに戻る」ボタンの動作確認', async ({ page }) => {
    // エラー情報をセッションストレージに設定
    await page.evaluate(() => {
      const errorDetails = {
        message: 'Test Error for Home Button',
        timestamp: new Date().toISOString(),
        url: 'http://localhost:3003/test-error',
        userAgent: navigator.userAgent
      };
      sessionStorage.setItem('errorBoundaryDetails', JSON.stringify(errorDetails));
    });

    // エラーページに移動
    await page.goto('/error');

    // セッションストレージにエラー情報が存在することを確認
    const storedError = await page.evaluate(() => {
      return sessionStorage.getItem('errorBoundaryDetails');
    });
    expect(storedError).toBeTruthy();

    // 「ホームに戻る」ボタンをクリック
    await page.locator('[data-testid="home-button"]').click();

    // ホームページにリダイレクトされることを確認
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page).toHaveURL('/');

    // セッションストレージからエラー情報がクリアされることを確認
    const clearedError = await page.evaluate(() => {
      return sessionStorage.getItem('errorBoundaryDetails');
    });
    expect(clearedError).toBeNull();
  });

  test('エラーページで「ページを再読み込み」ボタンの動作確認', async ({ page }) => {
    // エラー情報をセッションストレージに設定
    await page.evaluate(() => {
      const errorDetails = {
        message: 'Test Error for Reload Button',
        timestamp: new Date().toISOString(),
        url: 'http://localhost:3003/test-error',
        userAgent: navigator.userAgent
      };
      sessionStorage.setItem('errorBoundaryDetails', JSON.stringify(errorDetails));
    });

    // エラーページに移動
    await page.goto('/error');

    // ページ再読み込み前の状態を確認
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Test Error for Reload Button');

    // 「ページを再読み込み」ボタンをクリック
    await page.locator('[data-testid="reload-button"]').click();

    // ページが再読み込みされることを確認
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/error');

    // エラー情報が保持されていることを確認（セッションストレージは再読み込み後も残る）
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Test Error for Reload Button');
  });

  test('エラー情報が存在しない場合の表示確認', async ({ page }) => {
    // セッションストレージをクリア
    await page.evaluate(() => {
      sessionStorage.removeItem('errorBoundaryDetails');
    });

    // エラーページに直接アクセス
    await page.goto('/error');

    // エラー情報が見つからない旨のメッセージが表示されることを確認
    await expect(page.locator('h2')).toContainText('エラー情報が見つかりません');
    await expect(page.locator('text=エラー詳細情報が取得できませんでした')).toBeVisible();

    // アクションボタンは表示される
    await expect(page.locator('[data-testid="home-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="reload-button"]')).toBeVisible();

    // エラーレポートダウンロードボタンは表示されない
    await expect(page.locator('[data-testid="download-report-button"]')).not.toBeVisible();
  });

  test('開発環境でのエラーレポートダウンロード機能', async ({ page }) => {
    // 開発環境でのみテストを実行
    test.skip(process.env.NODE_ENV !== 'development', 'このテストは開発環境でのみ実行されます');

    // エラー情報をセッションストレージに設定
    await page.evaluate(() => {
      const errorDetails = {
        message: 'Test Error for Download Report',
        stack: 'Error: Test Error\\n    at Component',
        timestamp: new Date().toISOString(),
        url: 'http://localhost:3003/test-error',
        userAgent: navigator.userAgent,
        componentStack: '    in ErrorTriggerComponent'
      };
      sessionStorage.setItem('errorBoundaryDetails', JSON.stringify(errorDetails));
    });

    // エラーページに移動
    await page.goto('/error');

    // エラーレポートダウンロードボタンが表示されることを確認
    await expect(page.locator('[data-testid="download-report-button"]')).toBeVisible();

    // ダウンロード処理をモニタ
    const downloadPromise = page.waitForEvent('download');

    // エラーレポートダウンロードボタンをクリック
    await page.locator('[data-testid="download-report-button"]').click();

    // ダウンロードが開始されることを確認
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/error-report-\d+\.json/);
  });

  test('完全なエラー発生からリカバリまでのE2Eフロー', async ({ page }) => {
    // 1. テストページで正常状態を確認
    await page.goto('/test-error');
    await expect(page.locator('[data-testid="normal-content"]')).toBeVisible();

    // 2. エラーを発生させる
    await page.locator('[data-testid="trigger-error-button"]').click();

    // 3. Error Boundaryの一時メッセージを確認
    await expect(page.locator('text=エラー詳細画面に移動しています...')).toBeVisible();

    // 4. エラーページへのリダイレクトを確認
    await page.waitForURL('/error', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('アプリケーションエラーが発生しました');

    // 5. エラー詳細情報の表示を確認
    await expect(page.locator('[data-testid="error-message"]')).toContainText('E2E Test Error: エラーページへのリダイレクトテスト用のエラーです。');

    // 6. ホームに戻って正常状態に復旧
    await page.locator('[data-testid="home-button"]').click();
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page).toHaveURL('/');

    // 7. セッションストレージがクリアされていることを確認
    const clearedError = await page.evaluate(() => {
      return sessionStorage.getItem('errorBoundaryDetails');
    });
    expect(clearedError).toBeNull();
  });
});