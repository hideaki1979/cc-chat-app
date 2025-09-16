import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../../app/components/ErrorBoundary';

// エラーを故意に発生させるテスト用コンポーネント
const ThrowError = ({ shouldError }: { shouldError: boolean }) => {
  if (shouldError) {
    throw new Error('Test error for ErrorBoundary');
  }
  return <div>No error occurred</div>;
};

// カスタムフォールバック用テストコンポーネント
const CustomFallback = (error: Error, errorInfo: string) => (
  <div>
    <h2>カスタムエラー表示</h2>
    <p>エラー: {error.message}</p>
    <details>
      <summary>詳細情報</summary>
      <pre>{errorInfo}</pre>
    </details>
  </div>
);

describe('ErrorBoundary', () => {
  // コンソールエラーを一時的に無効化（テスト中のエラーログ出力を抑制）
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('正常時の動作', () => {
    test('エラーが発生しない場合は子コンポーネントを正常に表示', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error occurred')).toBeInTheDocument();
    });
  });

  describe('エラー発生時の動作', () => {
    test('エラーが発生した場合はデフォルトエラーUIを表示', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      // エラー見出しの確認
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();

      // エラーメッセージの確認
      expect(screen.getByText(/申し訳ございませんが、予期しないエラーが発生しました/)).toBeInTheDocument();

      // アクションボタンの確認
      expect(screen.getByText('ページを再読み込み')).toBeInTheDocument();
      expect(screen.getByText('エラーをクリア')).toBeInTheDocument();
    });

    test('カスタムフォールバックが提供された場合はそれを使用', () => {
      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('カスタムエラー表示')).toBeInTheDocument();
      expect(screen.getByText('エラー: Test error for ErrorBoundary')).toBeInTheDocument();
    });

    test('開発環境では詳細エラー情報を表示', () => {
      // 開発環境をモック
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      // 詳細情報セクションの確認
      const detailsElement = screen.getByText('開発者情報');
      expect(detailsElement).toBeInTheDocument();

      // 詳細を開いて内容確認
      fireEvent.click(detailsElement);
      expect(screen.getByText('エラーメッセージ:')).toBeInTheDocument();
      expect(screen.getByText(/Test error for ErrorBoundary/)).toBeInTheDocument();

      // 環境変数を元に戻す
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
      });
    });

    test('本番環境では詳細エラー情報を非表示', () => {
      // 本番環境をモック
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      // 詳細情報セクションが存在しないことを確認
      expect(screen.queryByText('開発者情報')).not.toBeInTheDocument();

      // 環境変数を元に戻す
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
      });
    });
  });

  describe('エラー復旧機能', () => {
    test('「エラーをクリア」ボタンが存在することを確認', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      // エラー状態の確認
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();

      // エラーをクリアボタンの存在確認
      const clearButton = screen.getByText('エラーをクリア');
      expect(clearButton).toBeInTheDocument();

      // ボタンがクリック可能であることを確認
      fireEvent.click(clearButton);
      // 注：実際の状態リセットはError Boundaryのライフサイクルにより制限されるため、
      // ここではボタンの存在とクリック可能性のみテスト
    });

    test('「ページを再読み込み」ボタンのクリック機能確認', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      // ページ再読み込みボタンの存在確認
      const reloadButton = screen.getByText('ページを再読み込み');
      expect(reloadButton).toBeInTheDocument();

      // ボタンがクリック可能であることを確認（エラーが発生しないことを確認）
      expect(() => {
        fireEvent.click(reloadButton);
      }).not.toThrow();
    });
  });

  describe('ログ出力の確認', () => {
    test('エラー発生時にconsole.errorでログ出力される', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      // console.errorが呼ばれたことを確認
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('アクセシビリティ', () => {
    test('エラーアイコンにaria-hiddenが設定されている', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      // SVGエレメントを直接検索
      const svgElement = document.querySelector('svg[aria-hidden="true"]');
      expect(svgElement).toBeInTheDocument();
      expect(svgElement).toHaveAttribute('aria-hidden', 'true');
    });

    test('ボタンに適切なフォーカス管理が設定されている', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldError={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByText('ページを再読み込み');
      const clearButton = screen.getByText('エラーをクリア');

      // ボタンがbutton要素であることを確認（デフォルトでtab可能）
      expect(reloadButton.tagName).toBe('BUTTON');
      expect(clearButton.tagName).toBe('BUTTON');

      // フォーカス管理クラスが設定されていることを確認
      expect(reloadButton).toHaveClass('focus:outline-none', 'focus:ring-2');
      expect(clearButton).toHaveClass('focus:outline-none', 'focus:ring-2');
    });
  });
});