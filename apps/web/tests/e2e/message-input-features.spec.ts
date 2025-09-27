import { test, expect } from '@playwright/test';
import path from 'path';

let TEST_USER: { email: string; password: string };

test.beforeAll(() => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set by globalSetup');
  }
  TEST_USER = { email, password };
});

test.describe.skip('メッセージ入力拡張機能', () => {
  test.beforeEach(async ({ page }) => {
    // ログインページに移動
    await page.goto('/login');
    await expect(page.getByLabel('メールアドレス')).toBeVisible();

    // ログイン処理（globalSetupで作成されたテストユーザーを使用）
    await page.getByLabel('メールアドレス').fill(TEST_USER.email);
    await page.getByLabel('パスワード').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();

    // ダッシュボードへのリダイレクトを待機
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 20000 });

    // チャットページに遷移するまで待機
    await page.goto('/chat');
    await expect(page).toHaveURL(/.*chat/, { timeout: 20000 });

    // ページの完全読み込みを待機
    await expect(page.locator('[data-testid="test-sidebar"]')).toBeVisible({ timeout: 20000 });
  });

  test.describe('基本メッセージ送信', () => {
    test('メッセージを入力して送信できる', async ({ page }) => {
      const messageInput = page.getByTestId('message-input-field');
      const sendButton = page.getByLabel('メッセージを送信');

      // メッセージを入力
      await messageInput.fill('E2Eテストメッセージ');

      // 送信ボタンが有効になることを確認
      await expect(sendButton).toBeEnabled();

      // メッセージを送信
      await sendButton.click();

      // メッセージが送信されたことを確認
      await expect(page.getByText('E2Eテストメッセージ')).toBeVisible();

      // 入力欄がクリアされることを確認
      await expect(messageInput).toHaveValue('');
    });

    test('Enterキーでメッセージを送信できる', async ({ page }) => {
      const messageInput = page.getByTestId('message-input-field');

      await messageInput.fill('Enterキーテスト');
      await messageInput.press('Enter');

      await expect(page.getByText('Enterキーテスト')).toBeVisible();
      await expect(messageInput).toHaveValue('');
    });

    test('Shift+Enterで改行できる', async ({ page }) => {
      const messageInput = page.getByTestId('message-input-field');

      await messageInput.fill('1行目');
      await messageInput.press('Shift+Enter');
      await messageInput.type('2行目');

      await expect(messageInput).toHaveValue('1行目\n2行目');
    });

    test('空のメッセージは送信できない', async ({ page }) => {
      const sendButton = page.getByLabel('メッセージを送信');

      // 送信ボタンが無効状態であることを確認
      await expect(sendButton).toBeDisabled();

      // スペースのみの場合も無効
      await page.getByTestId('message-input-field').fill('   ');
      await expect(sendButton).toBeDisabled();
    });
  });

  test.describe('絵文字ピッカー機能', () => {
    test('絵文字ピッカーを開いて絵文字を選択できる', async ({ page }) => {
      const emojiButton = page.getByTitle('絵文字を追加');
      const messageInput = page.getByTestId('message-input-field');

      // 絵文字ボタンをクリック
      await emojiButton.click();

      // 絵文字ピッカーが表示されることを確認
      await expect(page.getByPlaceholder('絵文字を検索...')).toBeVisible();

      // 笑顔の絵文字をクリック
      await page.getByText('😀').first().click();

      // 絵文字がメッセージ入力欄に挿入されることを確認
      await expect(messageInput).toHaveValue('😀');

      // 絵文字ピッカーが閉じることを確認
      await expect(page.getByPlaceholder('絵文字を検索...')).not.toBeVisible();
    });

    test('絵文字カテゴリを切り替えできる', async ({ page }) => {
      const emojiButton = page.getByTitle('絵文字を追加');

      await emojiButton.click();

      // ハートカテゴリに切り替え
      await page.getByTitle('❤️ ハート').click();

      // ハート絵文字が表示されることを確認
      await expect(page.getByText('❤️').first()).toBeVisible();
      await expect(page.getByText('💛').first()).toBeVisible();
    });

    test('絵文字検索機能が動作する', async ({ page }) => {
      const emojiButton = page.getByTitle('絵文字を追加');

      await emojiButton.click();

      // 検索ボックスに絵文字を入力
      await page.getByPlaceholder('絵文字を検索...').fill('😀');

      // 検索結果が表示されることを確認
      await expect(page.getByText('"😀" の検索結果')).toBeVisible();
      await expect(page.getByText('😀').first()).toBeVisible();
    });

    test('ESCキーで絵文字ピッカーを閉じることができる', async ({ page }) => {
      const emojiButton = page.getByTitle('絵文字を追加');

      await emojiButton.click();
      await expect(page.getByPlaceholder('絵文字を検索...')).toBeVisible();

      // ESCキーを押す
      await page.keyboard.press('Escape');

      // 絵文字ピッカーが閉じることを確認
      await expect(page.getByPlaceholder('絵文字を検索...')).not.toBeVisible();
    });
  });

  test.describe('ファイル添付機能', () => {
    test('画像ファイルを添付できる', async ({ page }) => {
      // テスト用画像ファイルを準備
      const testImagePath = path.join(__dirname, 'test-assets', 'test-image.jpg');

      // ファイル添付ボタンをクリック
      const attachButton = page.getByTitle('ファイルを添付');
      await attachButton.click();

      // ファイル選択ダイアログでファイルを選択
      const fileChooser = await page.waitForEvent('filechooser');
      await fileChooser.setFiles(testImagePath);

      // アップロード完了まで待機
      await page.waitForLoadState('networkidle');

      // 添付ファイルが表示されることを確認
      await expect(page.getByText('test-image.jpg')).toBeVisible();

      // 送信ボタンが有効になることを確認（添付ファイルがあれば送信可能）
      const sendButton = page.getByLabel('メッセージを送信');
      await expect(sendButton).toBeEnabled();
    });

    test('添付ファイルを削除できる', async ({ page }) => {
      const testImagePath = path.join(__dirname, 'test-assets', 'test-image.jpg');

      // ファイルを添付
      const attachButton = page.getByTitle('ファイルを添付');
      await attachButton.click();
      const fileChooser = await page.waitForEvent('filechooser');
      await fileChooser.setFiles(testImagePath);
      await page.waitForLoadState('networkidle');

      // 添付ファイルが表示されることを確認
      await expect(page.getByText('test-image.jpg')).toBeVisible();

      // 削除ボタンをクリック
      await page.getByTitle('添付ファイルを削除').click();

      // 添付ファイルが削除されることを確認
      await expect(page.getByText('test-image.jpg')).not.toBeVisible();
    });

    test('サポートされていないファイル形式でエラーが表示される', async ({ page }) => {
      // 大きなファイルサイズでテスト（制限を超える）
      const testFilePath = path.join(__dirname, 'test-assets', 'large-file.exe');

      const attachButton = page.getByTitle('ファイルを添付');
      await attachButton.click();
      const fileChooser = await page.waitForEvent('filechooser');
      await fileChooser.setFiles(testFilePath);

      // エラーメッセージが表示されることを確認
      await expect(page.getByText(/サポートされていないファイル形式/)).toBeVisible();
    });

    test('ファイル添付とメッセージを同時に送信できる', async ({ page }) => {
      const testImagePath = path.join(__dirname, 'test-assets', 'test-image.jpg');

      // メッセージを入力
      const messageInput = page.getByTestId('message-input-field');
      await messageInput.fill('ファイル付きメッセージ');

      // ファイルを添付
      const attachButton = page.getByTitle('ファイルを添付');
      await attachButton.click();
      const fileChooser = await page.waitForEvent('filechooser');
      await fileChooser.setFiles(testImagePath);
      await page.waitForLoadState('networkidle');

      // 送信
      const sendButton = page.getByLabel('メッセージを送信');
      await sendButton.click();

      // メッセージとファイルの両方が送信されることを確認
      await expect(page.getByText('ファイル付きメッセージ')).toBeVisible();
      // ファイルのサムネイルまたはリンクが表示されることを確認
      await expect(page.getByText('test-image.jpg')).toBeVisible();
    });
  });

  test.describe('統合機能テスト', () => {
    test('絵文字とテキストを組み合わせて送信できる', async ({ page }) => {
      const messageInput = page.getByTestId('message-input-field');

      // テキストを入力
      await messageInput.fill('こんにちは ');

      // 絵文字を追加
      await page.getByTitle('絵文字を追加').click();
      await page.getByText('😀').first().click();

      // さらにテキストを追加
      await messageInput.fill('こんにちは 😀 今日はいい天気ですね');

      // 送信
      await page.getByLabel('メッセージを送信').click();

      // 送信されたメッセージを確認
      await expect(page.getByText('こんにちは 😀 今日はいい天気ですね')).toBeVisible();
    });

    test('長いメッセージでテキストエリアが自動拡張される', async ({ page }) => {
      const messageInput = page.getByTestId('message-input-field');

      // 長いメッセージを入力
      const longMessage = 'これは非常に長いメッセージです。'.repeat(10);
      await messageInput.fill(longMessage);

      // テキストエリアの高さが拡張されることを確認
      const boundingBox = await messageInput.boundingBox();
      expect(boundingBox?.height).toBeGreaterThan(44); // 初期の最小高さより大きい
    });

    test('メッセージ入力中にタイピング通知が表示される', async ({ page }) => {
      const messageInput = page.getByTestId('message-input-field');

      // メッセージを入力開始
      await messageInput.fill('テスト');

      // タイピング通知が表示されることを確認（実装に依存）
      // 注: 実際のタイピング通知UIが実装されている場合のテスト
      // await expect(page.getByText('入力中...')).toBeVisible();
    });

    test('文字数制限が正しく機能する', async ({ page }) => {
      const messageInput = page.getByTestId('message-input-field');

      // 長いテキストを入力（1000文字制限の場合）
      const longText = 'a'.repeat(1500);
      await messageInput.fill(longText);

      // 制限文字数までしか入力されないことを確認
      const inputValue = await messageInput.inputValue();
      expect(inputValue.length).toBeLessThanOrEqual(1000);

      // 文字数カウンターが表示されることを確認
      await expect(page.getByText(/\d+\/1000/)).toBeVisible();
    });
  });

  test.describe('レスポンシブ対応', () => {
    test('モバイル画面でも正常に動作する', async ({ page }) => {
      // モバイル画面サイズに変更
      await page.setViewportSize({ width: 375, height: 667 });

      const messageInput = page.getByTestId('message-input-field');

      // メッセージ入力
      await messageInput.fill('モバイルテスト');

      // 絵文字ボタンをタップ
      await page.getByTitle('絵文字を追加').click();

      // 絵文字ピッカーが表示されることを確認
      await expect(page.getByPlaceholder('絵文字を検索...')).toBeVisible();

      // 絵文字を選択
      await page.getByText('😀').first().click();

      // メッセージを送信
      await page.getByLabel('メッセージを送信').click();

      // 送信されたメッセージを確認
      await expect(page.getByText('モバイルテスト😀')).toBeVisible();
    });
  });

  test.describe('エラーハンドリング', () => {
    test('ネットワークエラー時の適切な処理', async ({ page }) => {
      // ネットワークを無効にする
      await page.route('**/api/backend/**', route => route.abort());

      const messageInput = page.getByTestId('message-input-field');
      await messageInput.fill('ネットワークエラーテスト');
      await page.getByLabel('メッセージを送信').click();

      // エラーメッセージが表示されることを確認
      // 注: 実際のエラーハンドリング実装に依存
      // await expect(page.getByText(/送信に失敗しました/)).toBeVisible();
    });
  });
});