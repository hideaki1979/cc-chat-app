import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module環境で__dirnameを再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  // Dockerコンテナの起動・準備を考慮してタイムアウトを長めに設定
  timeout: 120 * 1000, // Global timeout for each test file
  expect: {
    timeout: 10 * 1000, // Timeout for individual expect() calls
  },

  // テスト全体のセットアップと後片付け
  globalSetup: path.resolve(__dirname, './tests/globalSetup.ts'),
  globalTeardown: path.resolve(__dirname, './tests/globalTeardown.ts'),

  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:3003',
    trace: 'on-first-retry', // 最初の再試行時にのみトレースを収集
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // globalSetupでDocker Composeを起動するため、webServerオプションは不要
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://localhost:3003',
  //   reuseExistingServer: !process.env.CI,
  // },
});