/**
 * エラーハンドリング関連のビジネスロジックを管理するサービス層
 * Server Components/Client Components両方で使用可能
 */

export interface AppError {
  message: string;
  type: 'validation' | 'network' | 'permission' | 'notFound' | 'server' | 'unknown';
  originalError?: unknown;
}

/**
 * エラーを統一されたフォーマットに変換
 * @param error - 元のエラー
 * @param context - エラーが発生したコンテキスト
 * @returns 統一されたエラー形式
 */
export const normalizeError = (error: unknown, context?: string): AppError => {
  const contextPrefix = context ? `${context}: ` : '';

  // Error オブジェクトの場合（標準的なJavaScriptエラー）
  if (error instanceof Error) {
    return {
      message: `${contextPrefix}${error.message}`,
      type: 'unknown',
      originalError: error,
    };
  }

  // 文字列エラーの場合（throwで直接文字列が投げられた場合）
  if (typeof error === 'string') {
    return {
      message: `${contextPrefix}${error}`,
      type: 'unknown',
      originalError: error,
    };
  }

  // その他の予期しない型のエラー（null, undefined, オブジェクトなど）
  return {
    message: `${contextPrefix}予期しないエラーが発生しました`,
    type: 'unknown',
    originalError: error,
  };
};

/**
 * ネットワークエラーかどうかを判定
 * @param error - エラー
 * @returns ネットワークエラーかどうか
 */
export const isNetworkError = (error: unknown): boolean => {
  // エラーオブジェクトにcodeプロパティが存在するかチェック
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    // 一般的なネットワークエラーコードを判定
    // NETWORK_ERROR: 一般的なネットワークエラー
    // ECONNABORTED: 接続タイムアウト
    // ERR_NETWORK: fetch APIのネットワークエラー
    return code === 'NETWORK_ERROR' || code === 'ECONNABORTED' || code === 'ERR_NETWORK';
  }
  return false;
};

/**
 * ユーザーフレンドリーなエラーメッセージを生成
 * @param error - アプリケーションエラー
 * @returns ユーザーに表示するメッセージ
 */
export const getUserFriendlyMessage = (error: AppError): string => {
  switch (error.type) {
    case 'network':
      return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
    case 'permission':
      return 'この操作を実行する権限がありません。';
    case 'notFound':
      return '要求された情報が見つかりませんでした。';
    case 'validation':
      return error.message; // バリデーションエラーはそのまま表示
    case 'server':
      return 'サーバーで問題が発生しました。しばらく待ってから再試行してください。';
    default:
      return error.message || '予期しないエラーが発生しました。';
  }
};

/**
 * エラーログ用の詳細情報を生成
 * @param error - アプリケーションエラー
 * @param additionalInfo - 追加情報
 * @returns ログ用の情報
 */
export const generateErrorLogInfo = (error: AppError, additionalInfo?: Record<string, unknown>) => {
  return {
    message: error.message,
    type: error.type,
    timestamp: new Date().toISOString(),
    originalError: error.originalError,
    ...additionalInfo,
  };
};

/**
 * エラーを安全にコンソールに出力
 * @param error - アプリケーションエラー
 * @param context - コンテキスト情報
 */
export const logError = (error: AppError, context?: string): void => {
  const logInfo = generateErrorLogInfo(error, context ? { context } : undefined);

  // 開発環境では詳細なエラー情報を出力（デバッグ用）
  if (process.env.NODE_ENV === 'development') {
    console.error('Application Error:', logInfo);
  } else {
    // 本番環境ではユーザーフレンドリーなメッセージのみ
    // セキュリティ上、内部実装の詳細は出力しない
    console.error('Error:', error.type, getUserFriendlyMessage(error));
  }
};