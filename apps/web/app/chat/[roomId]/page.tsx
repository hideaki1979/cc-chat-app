import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthenticatedPageWrapper } from '../../components/auth/AuthenticatedPageWrapper';
import { ChatRoomClient } from '../../components/pages/ChatRoomClient';

export const dynamic = 'force-dynamic';

interface ChatRoomPageProps {
  params: { roomId: string };
}

// SEO最適化のメタデータ生成
export async function generateMetadata({ params }: ChatRoomPageProps): Promise<Metadata> {
  // 本来はここでroomIdに基づいてルーム情報を取得するが、現在はプレースホルダー
  const { roomId } = params;

  return {
    title: `チャットルーム ${roomId} - CC Chat`,
    description: 'CC Chatリアルタイムチャットルーム',
    robots: 'noindex', // 認証が必要なページは検索エンジンにインデックスしない
  };
}

// Server Component
export default function ChatRoomPage({ params }: ChatRoomPageProps) {
  const { roomId } = params;

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