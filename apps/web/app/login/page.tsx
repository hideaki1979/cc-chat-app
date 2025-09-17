import type { Metadata } from 'next';
import { LoginPageContainer } from '../components/auth/LoginPageContainer';

// SSR設定: 認証関連ページはServer-Side Renderingで動的生成
export const dynamic = 'force-dynamic';

// SEO最適化のメタデータ生成
export const metadata: Metadata = {
  title: 'ログイン - CC Chat',
  description: 'CC Chatアカウントにログインしてチャットを始めましょう。',
  robots: 'noindex', // 認証ページは検索エンジンにインデックスしない
};

// Server Component（認証状態の確認やリダイレクトは含めない）
export default function LoginPage() {
  return <LoginPageContainer />;
}