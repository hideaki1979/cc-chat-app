'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth';
import { Button } from '@repo/ui/button';

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>ユーザー情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              ダッシュボード
            </h1>
            <Button onClick={handleLogout} variant="secondary">
              ログアウト
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                ようこそ、{user.username}さん！
              </h2>
              <p className="text-gray-600">
                メールアドレス: {user.email}
              </p>
              <p className="text-gray-600">
                ユーザーID: {user.id}
              </p>
              <p className="text-gray-600">
                登録日: {new Date(user.createdAt).toLocaleDateString('ja-JP')}
              </p>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                チャット機能（開発予定）
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-blue-700">
                  チャット機能はまだ実装されていません。
                  バックエンドAPI実装後に利用可能になります。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}