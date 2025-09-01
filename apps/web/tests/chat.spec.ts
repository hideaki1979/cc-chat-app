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

    // チャットページへ移動
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/);
  });

  test('チャット画面の基本レイアウト表示', async ({ page }) => {
    // ページタイトルを確認
    await expect(page).toHaveTitle(/CC Chat/);

    // サイドバーの存在確認
    await expect(page.getByRole('heading', { level: 1, name: 'CC Chat' })).toBeVisible();
    await expect(page.getByRole('button', { name: '新規ルーム' })).toBeVisible();

    // ユーザー情報の表示確認
    await expect(page.getByText(TEST_USER.name)).toBeVisible();
    await expect(page.getByText(TEST_USER.email)).toBeVisible();

    // 初期状態でルーム選択メッセージを表示
    await expect(page.getByRole('heading', { level: 3 }).filter({ hasText: 'チャットルームを選択してください' })).toBeVisible();
    await expect(page.getByText('左のサイドバーからチャットルームを選択するか')).toBeVisible();
  });

  test('ルーム一覧の表示とルーム選択', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    // ダミールームが表示されることを確認（ルーム名として）
    await expect(page.getByRole('button', { name: /一般チャット/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /山田太郎/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /プロジェクトA/ })).toBeVisible();

    // グループチャットのバッジ表示確認（少なくとも1つ表示されることを確認）
    await expect(page.getByText('グループ').first()).toBeVisible();

    // ルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();

    // ルーム選択後のヘッダー表示確認
    await expect(page.getByRole('heading', { level: 2, name: '一般チャット' })).toBeVisible();
    await expect(page.getByText('15人のメンバー')).toBeVisible();
    await expect(page.getByText('5人オンライン')).toBeVisible();
  });

  test('メッセージ表示機能', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    // 一般チャットルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();

    // ダミーメッセージが表示されることを確認
    await expect(page.getByText('おはようございます！今日もよろしくお願いします。')).toBeVisible();
    await expect(page.getByText('そうですね。午後の企画会議、準備はいかがですか？')).toBeVisible();
    await expect(page.getByText('資料の準備は完了しています！')).toBeVisible();

    // 送信者名の表示確認（自分のメッセージ以外）
    await expect(page.getByText('田中さん').first()).toBeVisible();
    await expect(page.getByText('佐藤さん').first()).toBeVisible();

    // 時刻表示の確認
    await expect(page.getByText('時間前').first()).toBeVisible();
  });

  test('メッセージ入力と送信機能', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    // ルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();

    // メッセージ入力フィールドの存在確認
    const messageInput = page.getByPlaceholder('一般チャットにメッセージを送信...');
    await expect(messageInput).toBeVisible();

    // メッセージを入力
    await messageInput.fill('これはテストメッセージです。');

    // 送信ボタンの有効化確認
    const sendButton = page.getByRole('button', { name: 'メッセージを送信' });
    await expect(sendButton).toBeEnabled();

    // 送信
    await sendButton.click();

    // 送信されたメッセージが表示されることを確認
    await expect(page.getByText('これはテストメッセージです。')).toBeVisible();

    // 入力フィールドがクリアされることを確認
    await expect(messageInput).toHaveValue('');
  });

  test('Enterキーでのメッセージ送信', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    // ルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();

    // メッセージ入力フィールドにフォーカス
    const messageInput = page.getByPlaceholder('一般チャットにメッセージを送信...');
    await messageInput.fill('Enterキーで送信テスト');

    // Enterキーを押して送信
    await messageInput.press('Enter');

    // 送信されたメッセージが表示されることを確認
    await expect(page.getByText('Enterキーで送信テスト')).toBeVisible();

    // 入力フィールドがクリアされることを確認
    await expect(messageInput).toHaveValue('');
  });

  test('Shift+Enterでの改行機能', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    // ルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();

    // メッセージ入力フィールドにフォーカス
    const messageInput = page.getByPlaceholder('一般チャットにメッセージを送信...');
    await messageInput.fill('1行目');

    // Shift+Enterで改行
    await messageInput.press('Shift+Enter');
    await messageInput.fill(await messageInput.inputValue() + '2行目');

    // 改行が含まれたテキストが入力されていることを確認
    const value = await messageInput.inputValue();
    expect(value).toContain('1行目\n2行目');
  });

  test('複数ルーム間の切り替え', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    // 最初のルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: '一般チャット' })).toBeVisible();

    // 別のルームに切り替え
    await page.getByRole('button', { name: /山田太郎/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: '山田太郎' })).toBeVisible();

    // ダイレクトメッセージの表示確認
    await expect(page.getByText('明日の会議の件でご相談があります。')).toBeVisible();
    await expect(page.getByText('事前に送付した方がよろしいでしょうか？')).toBeVisible();

    // プロジェクトAルームに切り替え
    await page.getByRole('button', { name: /プロジェクトA/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'プロジェクトA' })).toBeVisible();

    // メッセージが空であることを確認
    await expect(page.getByText('まだメッセージはありません。')).toBeVisible();

    // 元のルームに戻って内容が保持されているか確認
    await page.getByRole('button', { name: /一般チャット/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: '一般チャット' })).toBeVisible();
    await expect(page.getByText('おはようございます！今日もよろしくお願いします。')).toBeVisible();
  });

  test('レスポンシブ対応 - モバイル表示', async ({ page }) => {
    // モバイルサイズに設定
    await page.setViewportSize({ width: 375, height: 667 });
    // リロードしてリサイズを適用
    await page.reload();

    // サイドバーが初期状態で非表示であることを確認
    const sidebar = page.locator('[data-testid="test-sidebar"]');
    await expect(sidebar).not.toBeVisible();

    // ハンバーガーメニューボタンをクリック
    const hamburgerButton = page.getByRole('button', { name: /サイドバーを/ });
    await hamburgerButton.click();

    // サイドバーが開くことを確認
    await expect(sidebar).toBeVisible();
  });

  test('ショートカットヒントの表示', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    // ルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();

    // ショートカットヒントが表示されることを確認
    await expect(page.getByText('Enter: 送信')).toBeVisible();
    await expect(page.getByText('Shift + Enter: 改行')).toBeVisible();
  });

  test('ヘッダーボタンの表示', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: /サイドバーを/ }).click();
    }
    // ルームを選択
    await page.getByRole('button', { name: /一般チャット/ }).click();

    // ヘッダーのアクションボタンが表示されることを確認
    await expect(page.getByTitle('音声通話')).toBeVisible();
    await expect(page.getByTitle('ビデオ通話')).toBeVisible();
    await expect(page.getByTitle('ルーム設定')).toBeVisible();

    // ボタンが有効状態であることを確認
    await expect(page.getByTitle('音声通話')).toBeEnabled();
    await expect(page.getByTitle('ビデオ通話')).toBeEnabled();
    await expect(page.getByTitle('ルーム設定')).toBeEnabled();
  });

  test('ログアウト機能', async ({ page }) => {
    // ログアウトボタンをクリック
    const logoutButton = page.getByTitle('ログアウト');
    await logoutButton.click();

    // ログインページまたは認証が必要な場合のリダイレクトを確認
    // middlewareによりログインページにリダイレクトされる
    await expect(page).toHaveURL(/.*login/);

    // ログアウト後に保護されたルートにアクセスできないことを確認
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*login/);
  });
});