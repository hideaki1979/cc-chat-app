/**
 * CSRF (Cross-Site Request Forgery) 保護のためのユーティリティ
 * 二重送信Cookie方式を使用
 */

// CSRF トークンをCookieから取得
export function getCSRFTokenFromCookie(): string | null {
  // SSR環境では document が存在しないため早期リターン
  if (typeof document === 'undefined') return null;

  // 正規表現でcsrf_tokenクッキーを検索
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (!match) return null;
  try {
    const value = match[1];
    if (!value) return null;
    // URLエンコードされている可能性があるためデコードを試行
    return decodeURIComponent(value);
  } catch {
    // デコードに失敗した場合は生の値を返す（フォールバック）
    return match[1] ?? null;
  }
}

// CSRF トークンを新規取得（初回アクセス時など）
export async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/backend/csrf', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Failed to fetch CSRF token:', response.status);
      return null;
    }

    const data = await response.json();
    return data.csrf_token || null;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return null;
  }
}

// CSRF トークンをHTTPヘッダーに追加
export function addCSRFHeader(headers: HeadersInit = {}): HeadersInit {
  const csrfToken = getCSRFTokenFromCookie();

  if (csrfToken) {
    return {
      ...headers,
      'X-CSRF-Token': csrfToken,
    };
  }

  return headers;
}

// Fetch APIでCSRF保護されたリクエストを送信
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';

  // GET, HEAD, OPTIONS, TRACE は状態変更を伴わないためCSRF保護不要
  if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    return fetch(url, {
      ...options,
      credentials: 'include',  // Cookieの自動送信は継続
    });
  }

  // POST, PUT, PATCH, DELETE は状態変更を伴うためCSRFトークンが必要
  let csrfToken = getCSRFTokenFromCookie();

  // CSRFトークンが無い場合は新規取得を試行（初回アクセス等）
  if (!csrfToken) {
    csrfToken = await fetchCSRFToken();
    if (!csrfToken) {
      throw new Error('CSRF token not available');
    }
  }

  // 取得したトークンを直接ヘッダに設定（Cookie再読込による競合を回避）
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('X-CSRF-Token', csrfToken);

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
}