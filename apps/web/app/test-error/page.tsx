'use client';

import { useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';

/**
 * Error Boundary テスト用コンポーネント
 * 故意にエラーを発生させてError Boundaryの動作を確認
 */
const ErrorTriggerComponent = ({ shouldThrowError }: { shouldThrowError: boolean }) => {
  if (shouldThrowError) {
    // 故意にエラーを発生させる
    throw new Error('E2E Test Error: エラーページへのリダイレクトテスト用のエラーです。');
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6" data-testid="normal-content">
      <h3 className="text-lg font-semibold text-green-800 mb-2">正常動作中</h3>
      <p className="text-green-700">
        Error Boundaryが正常に機能しており、エラーは発生していません。
      </p>
    </div>
  );
};

/**
 * Error Boundaryテスト用ページ
 * E2Eテストでエラーページへのリダイレクトをテスト
 */
export default function TestErrorPage() {
  const [shouldTriggerError, setShouldTriggerError] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Error Boundary E2E テストページ
          </h1>
          <p className="text-gray-600">
            このページはError BoundaryのE2Eテスト専用です。
            エラーページへのリダイレクトをテストします。
          </p>
        </div>

        {/* テストコントロールパネル */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">テストコントロール</h2>

          <div className="space-y-4">
            <button
              data-testid="trigger-error-button"
              onClick={() => setShouldTriggerError(true)}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              disabled={shouldTriggerError}
            >
              {shouldTriggerError ? 'エラー発生済み - リダイレクト待機中...' : 'エラーを発生させる（エラーページへリダイレクト）'}
            </button>

            <button
              data-testid="reset-button"
              onClick={() => setShouldTriggerError(false)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              disabled={shouldTriggerError}
            >
              状態をリセット
            </button>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              <strong>現在の状態:</strong> {shouldTriggerError ? 'エラー発生 - リダイレクト処理中' : '正常動作'}
            </p>
          </div>
        </div>

        {/* Error Boundaryでラップされたテスト対象エリア（リダイレクト有効） */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            テスト対象エリア (Error Boundary + エラーページリダイレクト)
          </h2>

          <ErrorBoundary redirectToErrorPage={true} redirectDelay={1000}>
            <ErrorTriggerComponent shouldThrowError={shouldTriggerError} />
          </ErrorBoundary>
        </div>

        {/* テスト情報 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">テスト手順（E2E自動テスト用）</h3>
          <ol className="list-decimal list-inside text-blue-700 space-y-2">
            <li>「エラーを発生させる」ボタンをクリック</li>
            <li>Error Boundaryによる一時的なメッセージが表示される</li>
            <li>2秒後に自動的に /error ページにリダイレクトされる</li>
            <li>/error ページでエラー詳細情報が表示される</li>
            <li>「ホームに戻る」ボタンで正常にホームページに戻る</li>
          </ol>
        </div>
      </div>
    </div>
  );
}