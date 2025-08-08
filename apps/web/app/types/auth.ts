export interface User {
  id: string;
  email: string;
  name: string;  // バックエンドではnameフィールド
  profile_image_url?: string;  // バックエンドではprofile_image_url
  bio?: string;
  created_at: string;  // バックエンドではcreated_at
  updated_at: string;  // バックエンドではupdated_at
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;  // フォームではusername、APIにはnameで送信
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: User;
  token: string;  // access_tokenのみ、refresh_tokenはhttpOnly Cookieで管理
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;  // メモリ内のみ保存
  // refreshTokenは削除（httpOnly Cookieで管理）
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;