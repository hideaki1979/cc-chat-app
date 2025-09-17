import type { Metadata } from 'next';
import { AuthenticatedPageWrapper } from '../components/auth/AuthenticatedPageWrapper';
import { ChatPageClient } from '../components/pages/ChatPageClient';

// SSR設定: リアルタイム機能は動的レンダリング
export const dynamic = 'force-dynamic';

// SEO最適化のメタデータ生成
export const metadata: Metadata = {
  title: 'チャット - CC Chat',
  description: 'CC Chatリアルタイムチャット。チャットルームでのコミュニケーション。',
  robots: 'noindex', // 認証が必要なページは検索エンジンにインデックスしない
};

// Server Component（静的コンテンツとメタデータを提供）
export default function ChatPage() {
  return (
    <AuthenticatedPageWrapper
      title="チャット"
      description="リアルタイムチャット機能"
    >
      <ChatPageClient />
    </AuthenticatedPageWrapper>
  );
}