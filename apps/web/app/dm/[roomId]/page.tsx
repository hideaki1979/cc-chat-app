import { DMPageClient } from './DMPageClient';

interface Props {
  params: { roomId: string }
}

/**
 * DM (Direct Message) ページ - Server Component
 * 
 * Next.js 15 App Router最適化:
 * - Server Component として実装（SEO最適化）
 * - Client Component分離でhydration最適化
 * - roomId事前検証・型安全性確保
 */
export default function DMPage({ params }: Props) {
  return <DMPageClient roomId={params.roomId} />;
}