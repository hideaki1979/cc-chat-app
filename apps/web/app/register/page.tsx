import type { Metadata } from 'next';
import { RegisterPageContainer } from '../components/auth/RegisterPageContainer';

// SSR設定: 認証関連ページはServer-Side Renderingで動的生成
export const dynamic = 'force-dynamic';

// SEO最適化のメタデータ生成
export const metadata: Metadata = {
  title: '新規登録 - CC Chat',
  description: 'CC Chatアカウントを作成してリアルタイムチャットを始めましょう。',
  robots: 'noindex', // 認証ページは検索エンジンにインデックスしない
};

// Server Component（認証状態の確認やリダイレクトは含めない）
export default function RegisterPage() {
  return <RegisterPageContainer />;
}