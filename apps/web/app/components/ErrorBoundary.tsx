'use client';

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: string) => ReactNode;
  redirectToErrorPage?: boolean; // エラーページにリダイレクトするかどうか
  redirectDelay?: number; // リダイレクトの遅延時間（ミリ秒、デフォルト2000）
}

/**
 * Error Boundary Component
 * React 19対応のエラーバウンダリー実装
 *
 * 機能:
 * - 子コンポーネントでの予期しないエラーをキャッチ
 * - ユーザーフレンドリーなエラー画面の表示
 * - 開発環境での詳細エラー情報表示
 * - エラーからの復旧機能
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * エラーが発生した際に状態を更新
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * エラーをキャッチして詳細情報を保存
   * 本番環境では外部ログサービスに送信することを想定
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // コンポーネントスタック情報を状態に保存
    this.setState({ errorInfo: errorInfo.componentStack || undefined });

    // エラーログの出力（本番環境では外部サービスに送信）
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // エラー詳細情報をセッションストレージに保存（エラーページで使用）
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      componentStack: errorInfo.componentStack || undefined,
    };

    try {
      sessionStorage.setItem('errorBoundaryDetails', JSON.stringify(errorDetails));
    } catch (storageError) {
      console.error('エラー情報をセッションストレージに保存できませんでした:', storageError);
    }

    // リダイレクトが有効な場合はエラーページに遷移
    if (this.props.redirectToErrorPage && !this.props.fallback) {
      // 設定可能な遅延でリダイレクト（ユーザーがエラーを認識できるように）
      const delay = this.props.redirectDelay ?? 1000;
      setTimeout(() => {
        window.location.href = '/error';
      }, delay);
    }

    // TODO: 本番環境では Sentry, LogRocket などのエラー監視サービスに送信
    // if (process.env.NODE_ENV === 'production') {
    //   // 外部エラー監視サービスに送信
    //   errorReportingService.captureException(error, {
    //     extra: errorInfo,
    //     tags: { component: 'ErrorBoundary' }
    //   });
    // }
  }

  /**
   * エラー状態をクリアして復旧を試行
   */
  private handleErrorClear = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    });
  };

  /**
   * ページ全体を再読み込み
   */
  private handlePageReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // カスタムフォールバックUIが提供されている場合はそれを使用
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.state.errorInfo || '');
      }

      // リダイレクトが有効な場合は一時的なメッセージを表示
      if (this.props.redirectToErrorPage) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md w-full text-center">
              <div className="mb-6">
                <svg
                  className="mx-auto h-16 w-16 text-red-500 animate-pulse"
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                エラーが発生しました
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                エラー詳細画面に移動しています...
              </p>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                自動的にリダイレクトされない場合は{' '}
                <button
                  onClick={() => window.location.href = '/error'}
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  こちらをクリック
                </button>
                してください
              </p>
            </div>
          </div>
        );
      }

      // デフォルトのエラーUI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full text-center">
            {/* エラーアイコン */}
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-red-500"
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

            {/* エラーメッセージ */}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              エラーが発生しました
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              申し訳ございませんが、予期しないエラーが発生しました。<br />
              ページを再読み込みしてもう一度お試しください。
            </p>

            {/* アクションボタン */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handlePageReload}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                ページを再読み込み
              </button>
              <button
                onClick={this.handleErrorClear}
                className="inline-flex items-center justify-center px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                エラーをクリア
              </button>
            </div>

            {/* 開発環境での詳細エラー情報 */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-8 text-left bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border">
                <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300">
                  開発者情報
                </summary>
                <div className="mt-4 space-y-4">
                  <div>
                    <h4 className="font-semibold text-red-600 dark:text-red-400">エラーメッセージ:</h4>
                    <pre className="mt-1 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <h4 className="font-semibold text-red-600 dark:text-red-400">コンポーネントスタック:</h4>
                      <pre className="mt-1 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto">
                        {this.state.errorInfo}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    // エラーが発生していない場合は通常通り子コンポーネントをレンダリング
    return this.props.children;
  }
}