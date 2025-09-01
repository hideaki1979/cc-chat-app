import { test as setup, expect } from '@playwright/test';

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;
const authFile = 'playwright/.auth/user.json';

// 1分間のタイムアウトを設定
setup.setTimeout(60 * 1000);

setup('authenticate', async ({ page }) => {
    // ==================================================================
    // デバッグログ出力の追加
    // ==================================================================
    page.on('request', request => {
        console.log('>> Request:', request.method(), request.url());
        // console.log('   Headers:', request.headers()); // 必要に応じてヘッダーも表示
    });
    page.on('response', async response => {
        console.log('<< Response:', response.status(), response.url());
        // ログインAPIのレスポンスヘッダーを詳細に表示
        if (response.url().includes('/api/backend/login')) {
            console.log('   [Login Response Headers]:', await response.allHeaders());
        }
    });
    page.on('console', msg => console.log(`[Console] ${msg.type()}: ${msg.text()}`));
    // ==================================================================

    // バックエンドAPIが起動するのを待つ
    const apiHealthCheckUrl = 'http://localhost:8080/health';
    console.log(`Waiting for API to be ready at ${apiHealthCheckUrl}...`);
    await expect.poll(async () => {
        try {
            const response = await page.request.get(apiHealthCheckUrl);
            return response.ok();
        } catch (e) {
            return false;
        }
    }, {
        message: `API at ${apiHealthCheckUrl} did not become ready in time.`,
        intervals: [2000, 3000, 5000],
        timeout: 30000,
    }).toBeTruthy();
    console.log('API is ready!');

    // ログインページにアクセス
    await page.goto('/login');

    // ログイン処理をリトライする
    console.log('Attempting to log in...');
    await expect(async () => {
        // ログイン情報を入力
        await page.getByLabel('メールアドレス').fill(TEST_USER_EMAIL);
        await page.getByLabel('パスワード').fill(TEST_USER_PASSWORD);
        await page.getByRole('button', { name: 'ログイン' }).click();

        // ログイン後のダッシュボードへのリダイレクトを待つ
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 5000 });
    }).toPass({
        intervals: [2000, 3000, 5000],
        timeout: 30000,
    });
    console.log('Login successful!');


    // CookieやlocalStorageなどの認証情報をファイルに保存
    await page.context().storageState({ path: authFile });
    console.log(`Authentication state saved to ${authFile}`);
});
