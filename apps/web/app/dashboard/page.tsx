import type { Metadata } from 'next';
import { AuthenticatedPageWrapper } from '../components/auth/AuthenticatedPageWrapper';
import { DashboardPageClient } from '../components/pages/DashboardPageClient';

// SSR設定: 認証が必要なページは動的レンダリング
export const dynamic = 'force-dynamic';

// SEO最適化のメタデータ生成
export const metadata: Metadata = {
  title: 'ダッシュボード - CC Chat',
  description: 'CC Chatダッシュボード。ユーザー情報の確認とチャット機能へのアクセス。',
  robots: 'noindex', // 認証が必要なページは検索エンジンにインデックスしない
};

// Server Component（静的コンテンツとメタデータを提供）
export default function DashboardPage() {
  return (
    <AuthenticatedPageWrapper
      title="ダッシュボード"
      description="ユーザー情報とチャット機能へのアクセス"
    >
      <DashboardPageClient />
    </AuthenticatedPageWrapper>
  );
}