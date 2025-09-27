'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/auth';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@repo/ui/button';

/**
 * ダッシュボードページのClient Component部分
 * - 認証ロジックと動的な状態管理
 * - Server ComponentとClient Componentの境界を明確化
 */
export function DashboardPageClient() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const { user, isLoading, isInitialized } = useAuth();

  // 認証チェックはuseAuthフックで実施
  // 初期化完了まで待機

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  };

  // 初期化中またはローディング中の場合はローディング表示
  if (!isInitialized || isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role='status'
        aria-live='polite'
        aria-busy="true"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">ユーザー情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  // 初期化完了後、ユーザー情報がない場合（useAuthフックでリダイレクト処理済み）
  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role='status'
        aria-live='polite'
      >
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300">認証情報を確認中...</p>
        </div>
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
            <Button onClick={handleLogout} variant="secondary" className="mr-2 px-8">
              ログアウト
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                ようこそ、{user.name}さん！
              </h2>
              <p className="text-gray-600">
                メールアドレス: {user.email}
              </p>
              <p className="text-gray-600">
                ユーザーID: {user.id}
              </p>
              <p className="text-gray-600">
                登録日: {new Date(user.created_at).toLocaleDateString('ja-JP')}
              </p>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                利用可能な機能
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <h4 className="font-medium text-green-800 mb-2">リアルタイムチャット</h4>
                  <p className="text-green-700 text-sm mb-3">
                    グループチャットや個人チャットが利用できます。
                  </p>
                  <Button
                    onClick={() => {
                      router.push('/chat');
                    }}
                    className="w-full"
                  >
                    チャットを開始
                  </Button>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="font-medium text-gray-800 mb-2">プロフィール設定</h4>
                  <p className="text-gray-700 text-sm mb-3">
                    ユーザー名やアバター画像を変更できます。
                  </p>
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled
                  >
                    近日公開
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}