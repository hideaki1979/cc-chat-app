import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthenticatedPageWrapper } from '../../components/auth/AuthenticatedPageWrapper';
import { ChatRoomClient } from '../../components/pages/ChatRoomClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ roomId: string }>;
}

// SEO最適化のメタデータ生成
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // 本来はここでroomIdに基づいてルーム情報を取得するが、現在はプレースホルダー
  const { roomId } = await params;

  return {
    title: `チャットルーム ${roomId} - CC Chat`,
    description: 'CC Chatリアルタイムチャットルーム',
    robots: 'noindex', // 認証が必要なページは検索エンジンにインデックスしない
  };
}

// Server Component
export default async function ChatRoomPage({ params }: PageProps) {
  const { roomId } = await params;

  // roomIdの基本バリデーション
  if (!roomId || roomId.trim().length === 0) {
    notFound();
  }

  return (
    <AuthenticatedPageWrapper
      title={`チャットルーム ${roomId}`}
      description="リアルタイムチャット機能"
    >
      <ChatRoomClient roomId={roomId} />
    </AuthenticatedPageWrapper>
  );
}