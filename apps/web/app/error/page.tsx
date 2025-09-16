'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ErrorDetails {
  message: string;
  stack?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  componentStack?: string;
}

/**
 * エラー専用ページ
 * Error Boundaryからリダイレクトされた際にエラー詳細を表示
 */
export default function ErrorPage() {
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // セッションストレージからエラー情報を取得
    const storedError = sessionStorage.getItem('errorBoundaryDetails');

    if (storedError) {
      try {
        const errorData = JSON.parse(storedError) as ErrorDetails;
        setErrorDetails(errorData);
      } catch (parseError) {
        console.error('エラー情報の解析に失敗しました:', parseError);
      }
    }

    setIsLoading(false);
  }, []);

  /**
   * エラー情報をクリアしてホームに戻る
   */
  const clearErrorAndGoHome = () => {
    sessionStorage.removeItem('errorBoundaryDetails');
    window.location.href = '/';
  };

  /**
   * エラーレポートをダウンロード（デバッグ用）
   */
  const downloadErrorReport = () => {
    if (!errorDetails) return;

    const report = {
      ...errorDetails,
      reportGeneratedAt: new Date().toISOString(),
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
      },
      pageInfo: {
        url: window.location.href,
        referrer: document.referrer,
        title: document.title,
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">エラー情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <svg
              className="mx-auto h-20 w-20 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            アプリケーションエラーが発生しました
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            申し訳ございませんが、予期しないエラーが発生しました。
            以下の情報を開発チームに共有していただけると問題の解決に役立ちます。
          </p>
        </div>

        {/* エラー詳細情報 */}
        {errorDetails ? (
          <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">エラー詳細情報</h2>

            <div className="space-y-6">
              {/* 基本情報 */}
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">基本情報</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="font-medium text-gray-700">発生日時:</span>
                    <p className="text-gray-600 mt-1">
                      {new Date(errorDetails.timestamp).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="font-medium text-gray-700">発生ページ:</span>
                    <p className="text-gray-600 mt-1 break-all">{errorDetails.url}</p>
                  </div>
                </div>
              </div>

              {/* エラーメッセージ */}
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">エラーメッセージ</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-mono text-sm" data-testid="error-message">
                    {errorDetails.message}
                  </p>
                </div>
              </div>

              {/* スタックトレース（開発環境のみ） */}
              {process.env.NODE_ENV === 'development' && errorDetails.stack && (
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">スタックトレース</h3>
                  <details className="bg-gray-100 border border-gray-200 rounded-lg">
                    <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50">
                      詳細なスタックトレースを表示
                    </summary>
                    <div className="p-4 border-t border-gray-200">
                      <pre className="text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
                        {errorDetails.stack}
                      </pre>
                    </div>
                  </details>
                </div>
              )}

              {/* コンポーネントスタック（開発環境のみ） */}
              {process.env.NODE_ENV === 'development' && errorDetails.componentStack && (
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">コンポーネントスタック</h3>
                  <details className="bg-blue-50 border border-blue-200 rounded-lg">
                    <summary className="p-4 cursor-pointer font-medium hover:bg-blue-50">
                      コンポーネント階層を表示
                    </summary>
                    <div className="p-4 border-t border-blue-200">
                      <pre className="text-xs text-blue-700 overflow-auto whitespace-pre-wrap">
                        {errorDetails.componentStack}
                      </pre>
                    </div>
                  </details>
                </div>
              )}

              {/* ブラウザ情報 */}
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">環境情報</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-600 font-mono break-all">
                    {errorDetails.userAgent}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              エラー情報が見つかりません
            </h2>
            <p className="text-yellow-700">
              エラー詳細情報が取得できませんでした。直接このページにアクセスされた可能性があります。
            </p>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={clearErrorAndGoHome}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            data-testid="home-button"
          >
            ホームに戻る
          </button>

          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-600 text-white text-base font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
            data-testid="reload-button"
          >
            ページを再読み込み
          </button>

          {errorDetails && process.env.NODE_ENV === 'development' && (
            <button
              onClick={downloadErrorReport}
              className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white text-base font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
              data-testid="download-report-button"
            >
              エラーレポートをダウンロード
            </button>
          )}
        </div>

        {/* フッター */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            問題が継続する場合は、{' '}
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-500 underline"
            >
              ホームページ
            </Link>
            {' '}から再度お試しいただくか、システム管理者にお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}