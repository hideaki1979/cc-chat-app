import Link from 'next/link';
import type { Metadata } from 'next';
import { BackButton } from './components';

/**
 * 404 Not Found ページ
 * Next.js 13+ App Router の規約に従った404エラーページ
 *
 * 自動的に発動される条件:
 * - 存在しないルートへのアクセス
 * - notFound() 関数の呼び出し
 */
export const metadata: Metadata = {
  title: 'ページが見つかりません - CC Chat',
  description: 'お探しのページが見つかりませんでした。URLをご確認ください。',
};

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* メインコンテンツ */}
      <div className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          {/* 404アイコン */}
          <div className="mb-8">
            <div className="relative">
              {/* 大きな404テキスト */}
              <div className="text-9xl font-bold text-gray-200 select-none" aria-hidden="true">
                404
              </div>

              {/* 中央のアイコン */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="h-16 w-16 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-3v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* メッセージ */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4" data-testid="not-found-title">
            ページが見つかりません
          </h1>

          <p className="text-lg text-gray-600 mb-8" data-testid="not-found-description">
            申し訳ございませんが、お探しのページは存在しないか、
            <br className="hidden sm:inline" />
            移動または削除された可能性があります。
          </p>

          {/* 推奨アクション */}
          <div className="space-y-4">
            {/* ホームに戻るボタン */}
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              data-testid="home-link"
            >
              <svg
                className="mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              ホームに戻る
            </Link>

            {/* 前のページに戻るボタン */}
            <BackButton />
          </div>
        </div>
      </div>

      {/* 推奨リンク */}
      <div className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-md mx-auto px-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            よく利用されるページ
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/"
              className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              data-testid="home-shortcut"
            >
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-blue-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-gray-900">ホーム</h3>
                  <p className="text-sm text-gray-600">トップページ</p>
                </div>
              </div>
            </Link>

            <Link
              href="/login"
              className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              data-testid="login-shortcut"
            >
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-green-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-gray-900">ログイン</h3>
                  <p className="text-sm text-gray-600">アカウントにログイン</p>
                </div>
              </div>
            </Link>

            <Link
              href="/register"
              className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              data-testid="register-shortcut"
            >
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-purple-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-gray-900">新規登録</h3>
                  <p className="text-sm text-gray-600">アカウント作成</p>
                </div>
              </div>
            </Link>

            <Link
              href="/chat"
              className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              data-testid="chat-shortcut"
            >
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-orange-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-gray-900">チャット</h3>
                  <p className="text-sm text-gray-600">チャットルーム</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="bg-gray-100 py-4">
        <div className="max-w-md mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            URLが正しく入力されているかご確認ください。
            <br />
            問題が続く場合は、システム管理者にお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}