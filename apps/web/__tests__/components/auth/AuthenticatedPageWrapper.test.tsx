import { render, screen } from '@testing-library/react';
import { AuthenticatedPageWrapper } from '../../../app/components/auth/AuthenticatedPageWrapper';

describe('AuthenticatedPageWrapper', () => {
  test('タイトルと説明文がSEO用に表示される', () => {
    render(
      <AuthenticatedPageWrapper title="テストページ" description="テスト説明">
        <div data-testid="child-content">子コンポーネント</div>
      </AuthenticatedPageWrapper>
    );

    // SEO用の要素（screen readerのみ）
    expect(screen.getByText('テストページ')).toBeInTheDocument();
    expect(screen.getByText('テスト説明')).toBeInTheDocument();

    // 子コンポーネントが正しく表示される
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('子コンポーネント')).toBeInTheDocument();
  });

  test('説明文なしでも正常に動作する', () => {
    render(
      <AuthenticatedPageWrapper title="タイトルのみ">
        <div data-testid="child-content">子コンポーネント</div>
      </AuthenticatedPageWrapper>
    );

    expect(screen.getByText('タイトルのみ')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  test('複数の子コンポーネントを受け入れる', () => {
    render(
      <AuthenticatedPageWrapper title="複数子要素">
        <div data-testid="child-1">子要素1</div>
        <div data-testid="child-2">子要素2</div>
      </AuthenticatedPageWrapper>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });
});