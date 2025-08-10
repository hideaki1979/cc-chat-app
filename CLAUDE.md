# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC Chat App is a Turborepo monorepo containing a real-time chat application with:

- **Frontend**: Next.js 15 with React 19, TailwindCSS, and TypeScript
- **Backend**: Go API using Echo framework and Ent ORM
- **Database**: PostgreSQL with containerized development environment

## Development Commands

### Build Commands

```bash
# Build all apps and packages
pnpm build

# Build specific app
turbo build --filter=web
turbo build --filter=api
turbo build --filter=docs
```

### Development Server

```bash
# Start all development servers
pnpm dev

# Start specific app
turbo dev --filter=web     # Next.js on port 3003
turbo dev --filter=docs    # Docs on default port
```

### Go Backend Development

```bash
# Run Go API server (from apps/api directory)
cd apps/api
pnpm dev  # Uses Air for hot reload via .air.toml
# OR
go run main.go

# Database setup required:
# Set DATABASE_URL environment variable
# Set RUN_MIGRATIONS=true for schema creation
```

### Docker Development

```bash
# Full stack with database
docker-compose up

# Services:
# - PostgreSQL on port 5433
# - Go API on port 8080
# - Next.js on port 3003
```

### Testing

```bash
# Frontend tests
cd apps/web
pnpm test              # Jest unit tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:e2e          # Playwright E2E tests
pnpm test:e2e:ui       # Playwright UI mode
```

### Linting and Type Checking

```bash
pnpm lint              # ESLint all packages
pnpm check-types       # TypeScript type checking
pnpm format           # Prettier formatting
```

## Architecture

### Monorepo Structure

```
apps/
├── web/          # Next.js frontend (port 3003)
├── api/          # Go backend (port 8080)
└── docs/         # Documentation site

packages/
├── ui/                    # Shared React components
├── eslint-config/         # ESLint configurations
├── typescript-config/     # TypeScript configurations
└── tailwind-config/       # TailwindCSS configurations
```

### Backend Architecture (Go)

- **Framework**: Echo v4 for HTTP routing and middleware
- **ORM**: Ent for database schema and operations
- **Database**: PostgreSQL with connection pooling
- **Auth**: JWT-based authentication with middleware
- **Structure**:
  ```
  apps/api/
  ├── main.go              # Application entry point
  ├── internal/
  │   ├── handlers/        # HTTP request handlers
  │   ├── middleware/      # JWT auth middleware
  │   ├── auth/           # Authentication logic
  │   └── models/         # Data models
  └── ent/                # Generated ORM code
      └── schema/         # Database schema definitions
  ```

### Frontend Architecture (Next.js)

- **Framework**: Next.js 15 with App Router
- **State Management**: Zustand for client state
- **Forms**: React Hook Form with Zod validation
- **Styling**: TailwindCSS with shared design system
- **API**: Axios client with centralized configuration
- **Structure**:
  ```
  apps/web/app/
  ├── components/         # Reusable UI components
  ├── stores/            # Zustand stores
  ├── lib/              # Utilities and API client
  ├── types/            # TypeScript type definitions
  └── (routes)/         # App Router pages
  ```

## Key Technologies

### Frontend Stack

- **Next.js 15.3.0**: React framework with App Router
- **React 19.1.0**: UI library with modern features
- **TailwindCSS 4.1.11**: Utility-first CSS framework
- **TypeScript 5.8.x**: Type-safe development
- **Zustand 5.0.6**: Lightweight state management
- **React Hook Form 7.60.0**: Form handling with validation
- **Zod 4.0.5**: Schema validation
- **Axios 1.10.0**: HTTP client

### Backend Stack

- **Go 1.24.5**: Backend language
- **Echo v4.13.4**: HTTP web framework
- **Ent v0.14.4**: Entity framework (ORM)
- **JWT v5.3.0**: Authentication tokens
- **PostgreSQL**: Database via lib/pq driver
- **Air**: Hot reload for development
- **UUID**: Google UUID package for IDs

### Development Tools

- **Turborepo 2.5.5**: Monorepo build system
- **pnpm 9.0.0**: Package manager
- **ESLint 9.31.0**: Code linting
- **Prettier 3.6.2**: Code formatting
- **Jest 30.0.4**: Unit testing
- **Playwright**: E2E testing

## Authentication Flow

1. **Registration**: POST `auth/register`
2. **Login**: POST `auth/login` → Returns JWT token
3. **Protected Routes**: Use JWT middleware on `/api` group
4. **Frontend State**: Managed via Zustand auth store
5. **Token Storage**: Client-side token management

## Development Notes

- **Language**: Interface supports Japanese (ログイン, チャットアプリ, etc.)
- **Ports**: Web (3003), API (8080), PostgreSQL (5433)
- **Hot Reload**: Frontend via Turbopack, Backend via Air
- **Type Safety**: Full TypeScript coverage across frontend
- **Component Library**: Shared UI components in `@repo/ui`
- **Testing**: Comprehensive Jest + Playwright setup
- **Docker**: Multi-service development environment ready

## コーディング規約

### Next.js / React / TypeScript ベストプラクティス

#### 推奨事項

- **App Router使用**: `pages`ディレクトリではなく`app`ディレクトリを使用
- **Server Components優先**: クライアント機能が不要な場合はServer Componentsを使用
- **TypeScript strict mode**: `tsconfig.json`で`strict: true`を設定
- **コンポーネント命名**: PascalCaseでファイル名とコンポーネント名を一致させる
- **Props型定義**: インターフェースまたは型エイリアスで明示的に定義
- **カスタムフック**: ロジックの再利用は`use`プレフィックスのカスタムフックで実装
- **Error Boundary**: エラーハンドリングは適切なError Boundaryで実装
- **動的インポート**: 大きなコンポーネントは`dynamic`でコード分割
- **Image最適化**: `next/image`コンポーネントを使用
- **Font最適化**: `next/font`でWebフォントを最適化
- **環境変数**: `NEXT_PUBLIC_`プレフィックスでクライアント側変数を明示

#### 禁止事項

- **useEffect乱用**: 不要な副作用やデータフェッチでの使用禁止
- **any型使用**: `any`型の使用は原則禁止、`unknown`を使用
- **インラインスタイル**: `style`プロップでのインラインスタイル禁止
- **直接DOM操作**: `document.getElementById`等の直接DOM操作禁止
- **key属性省略**: リスト要素での`key`属性省略禁止
- **useState初期化**: 関数呼び出しでの初期化は遅延初期化を使用
- **useCallback/useMemo乱用**: パフォーマンス問題がない限り使用禁止
- **default export乱用**: 名前付きexportを優先、default exportは最小限に

### Go / Echo / Ent ベストプラクティス

#### 推奨事項

- **パッケージ構成**: 機能別にパッケージを分割（handlers, middleware, models）
- **エラーハンドリング**: 全ての関数でエラーを適切に処理・返却
- **コンテキスト使用**: `context.Context`を第一引数で渡す
- **構造体タグ**: JSON、DB、バリデーションタグを適切に設定
- **インターフェース定義**: 小さなインターフェースで抽象化
- **ログ出力**: 構造化ログ（JSON形式）で出力
- **バリデーション**: リクエストデータは必ずバリデーション実行
- **トランザクション**: データベース操作は適切にトランザクション管理
- **JWT検証**: 認証が必要なエンドポイントでは必ずJWT検証
- **CORS設定**: 適切なCORS設定でセキュリティ確保

#### 禁止事項

- **panic使用**: `panic`の使用禁止、エラーを適切に返却
- **グローバル変数**: グローバル変数での状態管理禁止
- **SQL直書き**: 生SQLの直接実行禁止、Entを使用
- **パスワード平文**: パスワードの平文保存・ログ出力禁止
- **エラー無視**: `_`でのエラー無視禁止、必ず処理
- **goroutine乱用**: 不要なgoroutineの作成禁止
- **チャネル未クローズ**: チャネルのクローズ忘れ禁止
- **リソースリーク**: DB接続、ファイルハンドルのクローズ忘れ禁止
- **ハードコード**: 設定値のハードコード禁止、環境変数を使用
- **レスポンス未設定**: HTTPハンドラーでのレスポンス設定忘れ禁止

### アーキテクチャ設計原則

#### 責務分散（Separation of Concerns）

**Frontend責務分散**

```text
app/
├── components/           # UI表示のみ（プレゼンテーション層）
│   ├── ui/              # 汎用UIコンポーネント
│   └── features/        # 機能固有コンポーネント
├── stores/              # 状態管理（ビジネスロジック層）
├── lib/                 # ユーティリティ・API通信（データアクセス層）
├── types/               # 型定義
└── (routes)/            # ルーティング・ページ構成
```

**Backend責務分散**

```text
internal/
├── handlers/            # HTTPリクエスト処理（プレゼンテーション層）
├── services/            # ビジネスロジック（ドメイン層）
├── repositories/        # データアクセス（インフラ層）
├── middleware/          # 横断的関心事
└── models/              # ドメインモデル
```

#### スパゲッティコード防止規則

**Frontend アンチパターン禁止**

- **巨大コンポーネント**: 200行超のコンポーネント分割必須
- **Props drilling**: 3階層超の場合はContext/Zustandを使用
- **ビジネスロジック混在**: コンポーネント内でのAPI呼び出し・計算ロジック禁止
- **useEffect地獄**: 複数の副作用を1つのuseEffectに記述禁止
- **条件分岐ネスト**: 3階層超のif文ネスト禁止、早期リターンを使用
- **マジックナンバー**: 定数定義なしの数値使用禁止
- **グローバル状態乱用**: ローカル状態で済む場合のグローバル化禁止

**Backend アンチパターン禁止**

- **巨大関数**: 50行超の関数分割必須
- **God Object**: 複数責務を持つ構造体作成禁止
- **循環依存**: パッケージ間の循環依存禁止
- **深いネスト**: 4階層超のif文ネスト禁止
- **長いパラメータリスト**: 5個超のパラメータは構造体化
- **ハードコード分散**: 設定値の複数箇所記述禁止
- **エラー情報不足**: エラーメッセージに文脈情報不足禁止

#### ファイル責務定義

**Frontend ファイル責務**

- **Page Component**: ルーティング・レイアウト・データフェッチのみ
- **Feature Component**: 特定機能のUI・ユーザーインタラクションのみ
- **UI Component**: 汎用的な見た目・基本的な振る舞いのみ
- **Custom Hook**: 状態管理・副作用・ロジックの再利用のみ
- **Store**: グローバル状態・状態変更ロジックのみ
- **API Client**: HTTP通信・レスポンス変換のみ
- **Utility**: 純粋関数・汎用的な計算処理のみ

**Backend ファイル責務**

- **Handler**: HTTPリクエスト解析・レスポンス生成のみ
- **Service**: ビジネスルール・ドメインロジックのみ
- **Repository**: データベースアクセス・クエリ実行のみ
- **Model**: データ構造・バリデーションルールのみ
- **Middleware**: 認証・ログ・CORS等の横断的処理のみ
- **Config**: 設定値読み込み・環境変数管理のみ

#### 依存関係管理

**依存方向の原則**

```text
Frontend: Page → Feature → UI Component
          Page → Store → API Client
          Store ← Custom Hook

Backend:  Handler → Service → Repository
          Service → Model
          Handler → Middleware
```

**禁止依存パターン**

- **逆依存**: 下位層から上位層への依存禁止
- **横断依存**: 同階層間の直接依存禁止（共通層経由）
- **循環依存**: A→B→Aの循環参照禁止
- **密結合**: 具象クラスへの直接依存、インターフェース経由を推奨

### 共通規約

#### コード品質

- **命名規則**: 英語での明確で説明的な命名
- **コメント**: 複雑なロジックには日本語コメントを記述
- **テストカバレッジ**: 新機能には必ずテストを作成
- **リンター遵守**: ESLint、golangci-lintの警告は必ず修正
- **フォーマット**: Prettier、gofmtでコード整形
- **関数サイズ**: 1関数1責務、可読性を重視した適切なサイズ
- **ファイルサイズ**: 1ファイル500行以下を目安に分割

#### セキュリティ

- **入力検証**: 全ての外部入力は検証・サニタイズ
- **認証・認可**: 適切な認証・認可の実装
- **HTTPS使用**: 本番環境では必ずHTTPS使用
- **秘密情報**: 秘密情報のコードへのハードコード禁止
- **SQLインジェクション**: パラメータ化クエリ使用必須
- **XSS対策**: ユーザー入力の適切なエスケープ処理
