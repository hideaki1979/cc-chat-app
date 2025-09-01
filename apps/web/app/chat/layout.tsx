import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CC Chat - チャット',
  description: 'リアルタイムチャットアプリケーション',
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}