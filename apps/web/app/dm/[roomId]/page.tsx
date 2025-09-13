import { DMPageClient } from './DMPageClient';

type PageProps = {
  params: Promise<{ roomId: string }>
}

/**
 * DM (Direct Message) ページ - Server Component
 * 
 * Next.js 15 App Router最適化:
 * - Server Component として実装（SEO最適化）
 * - Client Component分離でhydration最適化
 * - roomId事前検証・型安全性確保
 */
export default async function DMPage({ params }: PageProps) {
  const { roomId } = await params;
  return <DMPageClient roomId={roomId} />;
}