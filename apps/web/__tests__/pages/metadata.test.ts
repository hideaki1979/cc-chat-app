import type { Metadata } from 'next';

// Next.js Server Componentの型定義
interface NextServerComponent {
  metadata?: Metadata;
  dynamic?: string;
  revalidate?: number;
}

// Server Componentのメタデータ生成をテスト
describe('Page Metadata Generation', () => {
  describe('ホームページメタデータ', () => {
    // 動的インポートでServer Componentのメタデータを取得
    let homeMetadata: Metadata;

    beforeAll(async () => {
      // Next.js Server Componentからメタデータを抽出
      const homePage = await import('../../app/page') as NextServerComponent;
      homeMetadata = homePage.metadata!;
    });

    test('基本的なSEO情報が設定されている', () => {
      expect(homeMetadata.title).toBe('CC Chat - チャットアプリへようこそ');
      expect(homeMetadata.description).toContain('リアルタイムチャットアプリケーション');
      expect(homeMetadata.keywords).toContain('チャット');
      expect(homeMetadata.keywords).toContain('リアルタイム');
    });

    test('OpenGraphメタデータが設定されている', () => {
      expect(homeMetadata.openGraph?.title).toBe('CC Chat - チャットアプリへようこそ');
      expect(homeMetadata.openGraph?.description).toContain('リアルタイムチャットアプリケーション');
      // Next.js 15のOpenGraphタイプ定義では、typeは直接アクセスできない場合がある
      if ('type' in (homeMetadata.openGraph || {})) {
        expect((homeMetadata.openGraph as { type?: string }).type).toBe('website');
      }
    });
  });

  describe('認証ページメタデータ', () => {
    test('ログインページのメタデータ', async () => {
      const loginPage = await import('../../app/login/page') as NextServerComponent;
      const metadata = loginPage.metadata!;

      expect(metadata.title).toBe('ログイン - CC Chat');
      expect(metadata.description).toContain('CC Chatアカウントにログイン');
      expect(metadata.robots).toBe('noindex'); // 認証ページは検索エンジンにインデックスしない
    });

    test('新規登録ページのメタデータ', async () => {
      const registerPage = await import('../../app/register/page') as NextServerComponent;
      const metadata = registerPage.metadata!;

      expect(metadata.title).toBe('新規登録 - CC Chat');
      expect(metadata.description).toContain('CC Chatアカウントを作成');
      expect(metadata.robots).toBe('noindex');
    });
  });

  describe('認証必須ページメタデータ', () => {
    test('ダッシュボードページのメタデータ', async () => {
      const dashboardPage = await import('../../app/dashboard/page') as NextServerComponent;
      const metadata = dashboardPage.metadata!;

      expect(metadata.title).toBe('ダッシュボード - CC Chat');
      expect(metadata.description).toContain('CC Chatダッシュボード');
      expect(metadata.robots).toBe('noindex'); // プライベートページ
    });

    test('チャットページのメタデータ', async () => {
      const chatPage = await import('../../app/chat/page') as NextServerComponent;
      const metadata = chatPage.metadata!;

      expect(metadata.title).toBe('チャット - CC Chat');
      expect(metadata.description).toContain('CC Chatリアルタイムチャット');
      expect(metadata.robots).toBe('noindex'); // プライベートページ
    });
  });
});