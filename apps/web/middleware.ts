import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 認証が必要なパス（保護されたルート）
const protectedRoutes = ['/dashboard', '/chat', '/profile'];

// 認証済みユーザーがアクセスできないパス（ゲストのみ）
const guestOnlyRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 静的ファイルやAPIルートは除外
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // refresh_tokenクッキーの存在をチェック
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const isAuthenticated = !!refreshToken;

  // 保護されたルートへのアクセス
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // 未認証の場合、ログインページにリダイレクト
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ゲストのみアクセス可能なルート
  if (guestOnlyRoutes.some(route => pathname.startsWith(route))) {
    if (isAuthenticated) {
      // 認証済みの場合、ダッシュボードにリダイレクト
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      const redirectTo = redirectParam && protectedRoutes.some(route => 
        redirectParam.startsWith(route)
      ) ? redirectParam : '/dashboard';
      
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    return NextResponse.next();
  }

  // ルートパス（/）の処理
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};