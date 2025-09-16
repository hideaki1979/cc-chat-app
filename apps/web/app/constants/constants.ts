export const HTTP_STATUS = {
    HTTP_STATUS_CONFLICT: 409
} as const;

export const REDIRECT_DELAY_MS = 3000;

export const DEFAULT_LOGIN_REDIRECT = '/dashboard';
export const LOGIN_PAGE_PATH = '/login';
export const REGISTER_PAGE_PATH = '/register';

// 認証不要なページ（パブリックページ）
export const PUBLIC_PAGES = [
  LOGIN_PAGE_PATH,
  REGISTER_PAGE_PATH,
  '/error',          // エラーページ
  '/test-error',     // テスト用エラーページ
  // 404ページ（not-found）は動的に判定
] as const;

export const AUTH_STORAGE_KEY = "auth-storage";

export const PAGE_SIZE = 50;
export const MAX_MESSAGE_LENGTH= 1000;
