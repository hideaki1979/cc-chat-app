# 🏗️ アーキテクチャリファクタリング計画

CLAUDE.md禁止事項分析に基づく構造的問題の解決計画。

## 📊 問題概要

| 分類                     | 問題数 | 影響度 | 対応期限 |
| ------------------------ | ------ | ------ | -------- |
| 巨大関数・コンポーネント | 4件    | 高     | 1週間    |
| 責務分散違反             | 3件    | 中     | 2週間    |
| 設計原則違反             | 3件    | 中     | 3週間    |

---

## 🎯 TASK-003: 巨大ハンドラー関数分割

### 📍 現在の問題

**ファイル**: `apps/api/internal/handlers/auth.go`

- `Register` 関数: **144行** (制限: 50行)
- `Login` 関数: **99行**
- `RefreshToken` 関数: **119行**

### 🏗️ 新しいアーキテクチャ

#### Before: 単一ハンドラー

```
AuthHandler
├── Register (144行) - 全責務混在
├── Login (99行) - 全責務混在
└── RefreshToken (119行) - 全責務混在
```

#### After: 層分離アーキテクチャ

```
Handler層 (HTTP処理のみ)
├── AuthHandler
│   ├── Register (30行)
│   ├── Login (25行)
│   └── RefreshToken (35行)

Service層 (ビジネスロジック)
├── AuthService
│   ├── RegisterUser
│   ├── AuthenticateUser
│   └── RefreshUserToken
└── TokenService
    ├── GenerateTokens
    ├── ValidateRefreshToken
    └── RotateTokens

Repository層 (データアクセス)
└── UserRepository
    ├── CreateUser
    ├── FindUserByEmail
    └── UpdateRefreshToken
```

### 📁 新ディレクトリ構造

```
apps/api/internal/
├── handlers/          # HTTP層
│   └── auth.go       # 薄いハンドラー (30-40行/関数)
├── services/         # ビジネスロジック層
│   ├── auth_service.go
│   └── token_service.go
├── repositories/     # データアクセス層
│   └── user_repository.go
└── models/          # ドメインモデル
    ├── user.go
    └── auth.go
```

### 🔄 実装例

#### 新AuthService

```go
// ✅ apps/api/internal/services/auth_service.go
package services

type AuthService struct {
    userRepo UserRepositoryInterface
    tokenSvc TokenServiceInterface
}

func (s *AuthService) RegisterUser(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
    // バリデーション
    if err := s.validateRegisterRequest(req); err != nil {
        return nil, err
    }

    // 重複チェック
    exists, err := s.userRepo.ExistsByEmail(ctx, req.Email)
    if err != nil {
        return nil, err
    }
    if exists {
        return nil, ErrEmailExists
    }

    // ユーザー作成
    user, err := s.userRepo.CreateUser(ctx, req)
    if err != nil {
        return nil, err
    }

    // トークン生成
    tokens, err := s.tokenSvc.GenerateTokens(user.ID, user.Email)
    if err != nil {
        return nil, err
    }

    return &AuthResponse{
        Token: tokens.AccessToken,
        User: user.ToUserInfo(),
    }, nil
}
```

#### 薄いハンドラー

```go
// ✅ 修正後: apps/api/internal/handlers/auth.go (30行)
func (h *AuthHandler) Register(c echo.Context) error {
    var req models.RegisterRequest
    if err := middleware.ValidateRequest(c, &req); err != nil {
        return err
    }

    response, err := h.authService.RegisterUser(c.Request().Context(), req)
    if err != nil {
        return h.handleError(c, err)
    }

    // Cookie設定
    h.setRefreshTokenCookie(c, response.RefreshToken)

    return c.JSON(http.StatusCreated, response)
}
```

### 📋 実装手順

1. [ ] サービス層インターfaces定義
2. [ ] AuthService実装
3. [ ] TokenService実装
4. [ ] UserRepository実装
5. [ ] ハンドラー層をサービス呼び出しに変更
6. [ ] 単体テスト作成
7. [ ] 統合テスト実行

**工数**: 4-6時間

---

## 🎯 TASK-021: 認証のCookie完全移行（アーキテクチャ）

### 📍 背景

現状は以下のハイブリッド構成：

- リフレッシュトークン: httpOnly + Secure(+Lax) Cookie（サーバー設定済み）
- アクセストークン: レスポンスJSONで返却し、フロントのメモリ保持＋`Authorization` ヘッダーで送出

最終目標は「アクセストークンも httpOnly Cookie で管理し、フロントはトークンを一切保持しない」設計へ移行。

### 🏗️ 設計方針

- サーバー: `access_token` も Set-Cookie（httpOnly, Secure, SameSite=Lax/Strict）
- クライアント: `Authorization` ヘッダー送出を廃止し、`credentials: 'include'` のみでAPI呼び出し
- 認証ミドルウェア: Cookie から `access_token` を検証（`Authorization`は後方互換で当面併用可）
- CSRF対策: SameSite=Lax維持に加え、state-changingリクエストにCSRFトークン（二重送信）導入

### 📁 変更箇所

- `apps/api/internal/handlers/auth.go`: `Login/Register/Refresh` で `access_token` Cookieも発行
- `apps/api/internal/middleware/jwt.go`: Cookieからの`access_token`読取対応
- `apps/web/app/api/backend/proxyHandler.ts`: `Authorization` 転送削除、Cookieパススルー前提
- `apps/web/app/stores/auth.ts`: `Authorization` ヘッダー付与ロジックの削除

### 📋 実装手順（概要）

1. ハンドラーで `access_token` の Set-Cookie 実装
2. JWTミドルウェアで Cookie を優先的に検証
3. フロントの `Authorization` 依存削除（fetchは`credentials: 'include'`）
4. CSRFトークン実装（Cookie+ヘッダー二重送信）
5. E2E/ユニットテスト更新

**工数**: 4-6時間

---

## 🎯 TASK-004: 巨大コンポーネント分割

### 📍 現在の問題

**ファイル**: `apps/web/app/components/LoginForm.tsx` (118行)

**責務混在**:

- UI表示
- フォーム状態管理
- バリデーション
- API呼び出し
- エラーハンドリング
- ルーティング

### 🏗️ 新しいコンポーネント構造

#### Before: 単一巨大コンポーネント

```
LoginForm (118行)
├── UI表示
├── 状態管理
├── バリデーション
├── API呼び出し
├── エラーハンドリング
└── ルーティング
```

#### After: 責務分離

```
LoginPage (15行) - ページコンポーネント
└── LoginFormContainer (25行) - コンテナコンポーネント
    ├── LoginFormUI (40行) - プレゼンテーション
    ├── useLoginForm (30行) - ロジックフック
    └── LoginFormLogic (20行) - ビジネスロジック
```

### 📁 新ファイル構造

```
apps/web/app/components/auth/
├── LoginPage.tsx          # ページコンポーネント
├── LoginFormContainer.tsx # コンテナ
├── LoginFormUI.tsx        # UI表示のみ
└── hooks/
    └── useLoginForm.ts    # フォームロジック

apps/web/app/lib/services/
└── auth-service.ts        # ビジネスロジック
```

### 🔄 実装例

#### プレゼンテーションコンポーネント

```typescript
// ✅ LoginFormUI.tsx (40行)
interface LoginFormUIProps {
  formState: UseFormReturn<LoginFormData>;
  onSubmit: (data: LoginFormData) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const LoginFormUI: React.FC<LoginFormUIProps> = ({
  formState: { register, handleSubmit, formState: { errors } },
  onSubmit,
  isLoading,
  error
}) => {
  return (
    <FormCard>
      <FormHeader title="アカウントにログイン" />
      <FormContainer onSubmit={handleSubmit(onSubmit)}>
        <FormFields>
          <Input
            label="メールアドレス"
            type="email"
            {...register('email')}
            error={errors.email?.message}
          />
          <Input
            label="パスワード"
            type="password"
            {...register('password')}
            error={errors.password?.message}
          />
        </FormFields>
        {error && <ErrorDisplay message={error} />}
        <Button type="submit" isLoading={isLoading}>
          ログイン
        </Button>
      </FormContainer>
    </FormCard>
  );
};
```

#### カスタムフック

```typescript
// ✅ useLoginForm.ts (30行)
export const useLoginForm = () => {
  const authService = useAuthService();
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleLogin = async (data: LoginFormData) => {
    const success = await authService.login(data);
    if (success) {
      const redirect = searchParams.get("redirect");
      const nextPath = redirect?.startsWith("/")
        ? redirect
        : DEFAULT_LOGIN_REDIRECT;
      router.push(nextPath);
    }
  };

  return {
    form,
    handleLogin,
    isLoading: authService.isLoading,
    error: authService.error,
  };
};
```

#### コンテナコンポーネント

```typescript
// ✅ LoginFormContainer.tsx (25行)
export const LoginFormContainer: React.FC = () => {
  const { form, handleLogin, isLoading, error } = useLoginForm();

  return (
    <LoginFormUI
      formState={form}
      onSubmit={handleLogin}
      isLoading={isLoading}
      error={error}
    />
  );
};
```

### 📋 実装手順

1. [ ] useLoginForm カスタムフック抽出
2. [ ] LoginFormUI プレゼンテーションコンポーネント作成
3. [ ] LoginFormContainer コンテナコンポーネント作成
4. [ ] 既存コンポーネント置換
5. [ ] 型安全性確認
6. [ ] 単体テスト追加

**工数**: 3-4時間

---

## 🎯 TASK-009: AuthHandler責務分離

### 📍 現在の問題

**ファイル**: `apps/api/internal/handlers/auth.go`

**単一ハンドラーに複数責務**:

- 認証処理 (Register, Login, Logout, RefreshToken)
- プロフィール管理 (Profile, UpdateProfile)
- ユーザー検索 (SearchUsers)
- ファイルアップロード (UploadAvatar)

### 🏗️ 新しいハンドラー構造

#### Before: God Object

```
AuthHandler (758行)
├── Register
├── Login
├── Logout
├── RefreshToken
├── Profile
├── UpdateProfile
├── SearchUsers
└── UploadAvatar
```

#### After: 責務分離

```
AuthHandler (200行)
├── Register
├── Login
├── Logout
└── RefreshToken

ProfileHandler (150行)
├── GetProfile
├── UpdateProfile
└── UploadAvatar

UserHandler (100行)
├── SearchUsers
└── GetUserById
```

### 📁 新ファイル構造

```
apps/api/internal/handlers/
├── auth.go          # 認証のみ
├── profile.go       # プロフィール管理
├── user.go          # ユーザー操作
└── base.go          # 共通処理
```

### 🔄 実装例

#### 基底ハンドラー

```go
// ✅ base.go - 共通処理
package handlers

type BaseHandler struct {
    logger echo.Logger
}

func (h *BaseHandler) handleError(c echo.Context, err error) error {
    // 共通エラーハンドリング
    switch {
    case errors.Is(err, ErrNotAuthenticated):
        return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
            Message: "認証が必要です",
            Code:    "NOT_AUTHENTICATED",
        })
    // ... その他のエラー処理
    default:
        h.logger.Error(err)
        return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
            Message: "内部サーバーエラー",
            Code:    "INTERNAL_ERROR",
        })
    }
}
```

#### 認証専用ハンドラー

```go
// ✅ auth.go - 認証処理のみ
type AuthHandler struct {
    BaseHandler
    authService AuthServiceInterface
}

func (h *AuthHandler) Register(c echo.Context) error {
    // 認証関連の処理のみ
}

func (h *AuthHandler) Login(c echo.Context) error {
    // 認証関連の処理のみ
}
```

#### プロフィール専用ハンドラー

```go
// ✅ profile.go - プロフィール管理
type ProfileHandler struct {
    BaseHandler
    profileService ProfileServiceInterface
}

func (h *ProfileHandler) GetProfile(c echo.Context) error {
    // プロフィール取得処理
}

func (h *ProfileHandler) UpdateProfile(c echo.Context) error {
    // プロフィール更新処理
}
```

### 📋 実装手順

1. [ ] BaseHandler抽出
2. [ ] AuthHandler機能絞り込み
3. [ ] ProfileHandler作成
4. [ ] UserHandler作成
5. [ ] main.goでのルーティング更新
6. [ ] 単体テスト分割
7. [ ] 統合テスト実行

**工数**: 4-5時間

---

## 🗓️ 実装スケジュール

### Week 1: バックエンド構造改善

- **Day 1-2**: TASK-003 ハンドラー関数分割
- **Day 3-4**: TASK-009 Handler責務分離
- **Day 5**: 統合テスト・動作確認

### Week 2: フロントエンド構造改善

- **Day 1-2**: TASK-004 コンポーネント分割
- **Day 3-4**: ビジネスロジック抽出
- **Day 5**: 型安全性確認・テスト

---

## 📊 完了基準

### コード品質メトリクス

- [ ] 関数行数: 50行以下
- [ ] コンポーネント行数: 100行以下
- [ ] 循環複雑度: 10以下
- [ ] 単一責務の原則遵守

### テスト品質

- [ ] 単体テストカバレッジ: 80%以上
- [ ] 統合テスト: 全APIエンドポイント
- [ ] E2Eテスト: 認証フロー全体

### レビュー完了

- [ ] コードレビュー（CLAUDE.md準拠）
- [ ] アーキテクチャレビュー
- [ ] セキュリティレビュー

---

**作成日**: 2025-01-04
**優先度**: HIGH
**期限**: 2週間
