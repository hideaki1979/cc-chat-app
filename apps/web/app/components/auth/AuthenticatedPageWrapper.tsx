import { ReactNode } from 'react';

interface AuthenticatedPageWrapperProps {
  children: ReactNode;
  title: string;
  description?: string;
}

/**
 * 認証が必要なページのServer Componentラッパー
 * - Server Componentとしてのメタデータと静的コンテンツを提供
 * - Client Componentである子コンポーネントで認証ロジックを処理
 * - SEO最適化とパフォーマンス最適化を両立
 */
export function AuthenticatedPageWrapper({
  children,
  title,
  description
}: AuthenticatedPageWrapperProps) {
  return (
    <>
      {/* Server ComponentでのSEO対応 */}
      <div className="sr-only">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>

      {/* Client Componentでの動的機能 */}
      {children}
    </>
  );
}