# CC Chat App - リファクタリングタスク

このドキュメントは、CLAUDE.mdの禁止事項に基づく実装分析結果から抽出されたリファクタリングタスクを管理します。

## 📊 概要

- **総発見問題数**: 13項目
- **高優先度**: 5項目（即座対応必須）
- **中優先度**: 5項目（1週間以内）
- **低優先度**: 3項目（1ヶ月以内）

---

## 🔴 高優先度タスク（即座対応必須）

### TASK-001: window オブジェクト汚染除去 🚨

**ファイル**: `apps/web/app/stores/auth.ts:287-290`
**問題**: グローバル変数での状態管理（セキュリティリスク）

```typescript
// 現在のコード（禁止）
if (typeof window !== "undefined") {
  window.authStore = useAuthStore; // ← グローバル汚染
}
```

**解決方法**:

- グローバル汚染を除去
- 必要に応じてContext APIまたはカスタムフックで状態共有
  **影響度**: 高（セキュリティ・メモリリーク）
  **工数**: 2-4時間

### TASK-002: localStorage直接アクセス修正 🚨

**ファイル**: `apps/web/app/stores/auth.ts:245-262`
**問題**: 直接DOM操作・localStorage操作

```typescript
// 現在のコード（禁止）
const storedAuth = localStorage.getItem("auth-storage");
```

**解決方法**:

- 専用のストレージユーティリティ関数を作成
- エラーハンドリングとSSR対応
  **影響度**: 高（セキュリティ・SSR互換性）
  **工数**: 1-2時間

### TASK-003: 巨大ハンドラー関数分割

**ファイル**: `apps/api/internal/handlers/auth.go`
**問題**: 50行超の関数（Register: 144行, Login: 99行, RefreshToken: 119行）
**解決方法**:

- 機能別に関数を分割
- サービス層への責務移譲

```
Register → RegisterUser + ValidateRegisterRequest + CreateUserAccount
Login → AuthenticateUser + GenerateTokens + SetAuthCookies
```

**影響度**: 高（可読性・保守性）
**工数**: 4-6時間

### TASK-004: 巨大コンポーネント分割

**ファイル**: `apps/web/app/components/LoginForm.tsx` (118行)
**問題**: 複数責務混在（UI・状態・ビジネスロジック）
**解決方法**:

```
LoginForm → LoginFormUI + useLoginForm + LoginFormLogic
- LoginFormUI: 表示のみ
- useLoginForm: 状態管理
- LoginFormLogic: ビジネスロジック
```

**影響度**: 高（可読性・再利用性）
**工数**: 3-4時間

### TASK-005: ハードコード設定の環境変数化

**ファイル**: `apps/api/main.go`
**問題**: 設定値の複数箇所記述

```go
const defaultPort = "8080"
allowOrigins := []string{"http://localhost:3003"}
db.SetMaxIdleConns(10)
db.SetMaxOpenConns(100)
```

**解決方法**:

- 設定ファイル・環境変数による管理
- config構造体での一元管理
  **影響度**: 中（保守性・デプロイ柔軟性）
  **工数**: 2-3時間

---

## 🟡 中優先度タスク（1週間以内）

### TASK-006: ビジネスロジック抽出

**ファイル**: `apps/web/app/components/chat/ChatArea.tsx`
**問題**: コンポーネント内でのAPI呼び出し・計算ロジック混在
**解決方法**:

- ビジネスロジックをサービス層に移動
- コンポーネントは純粋なUI表示に集中
  **工数**: 3-4時間

### TASK-007: useEffect最適化

**ファイル**: `apps/web/app/stores/auth.ts:21-24`
**問題**: 複数副作用の兆候・依存配列の不適切な無視
**解決方法**:

- 副作用を目的別に分離
- 適切な依存配列設定
  **工数**: 1-2時間

### TASK-008: Props drilling解消

**ファイル**: `apps/web/app/hooks/useChat.ts`
**問題**: 3階層以上のprops受け渡し
**解決方法**:

- Context API利用
- Zustandストア活用
  **工数**: 2-3時間

### TASK-009: AuthHandler責務分離

**ファイル**: `apps/api/internal/handlers/auth.go`
**問題**: 単一ハンドラーに複数責務（認証・プロフィール・検索・アップロード）
**解決方法**:

```
AuthHandler → AuthHandler + ProfileHandler + UserHandler
```

**工数**: 4-5時間

### TASK-010: エラーハンドリング強化

**ファイル**: `apps/api/internal/handlers/auth.go:266`
**問題**: TODOのまま放置されたエラーログ
**解決方法**:

- 構造化ログ実装
- エラーコンテキスト保持
  **工数**: 1-2時間

---

### TASK-021: 認証のCookie完全移行（フル移行）

**概要**: アクセストークンを httpOnly Cookie 化し、フロントからのトークン参照を撤廃。`credentials: 'include'` に統一し、JWT検証はCookie優先。CSRF二重送信導入。

**変更点**:

- `auth.go`: Login/Register/Refresh で `access_token` も Set-Cookie
- `middleware/jwt.go`: Cookieから`access_token`を検証
- `proxyHandler.ts`: Authorization転送削除、Cookieパススルー
- `stores/auth.ts`: Authorizationヘッダー付与ロジック撤廃

**テスト**:

- E2E: 認証フロー/プロフィール/メッセージ
- CSRF: 外部オリジンPOST拒否の確認

**優先度**: 中
**工数**: 4-6時間

---

## 🟢 低優先度タスク（1ヶ月以内）

### TASK-011: マジックナンバー定数化

**複数ファイル**
**問題**: 意味不明な数値のハードコード

```typescript
const maxFileSize = 5 * 1024 * 1024; // ← 5MB
```

```go
db.SetMaxIdleConns(10)  // ← 何の根拠？
db.SetMaxOpenConns(100)
```

**解決方法**: 定数ファイルまたは設定ファイルで管理
**工数**: 2-3時間

### TASK-012: ファイル責務整理

**ファイル**: `useChat.ts`, `auth.go`
**問題**: APIクライアント + ビジネスロジック混在
**解決方法**:

- レイヤー別ファイル分離
- 単一責務の原則適用
  **工数**: 3-4時間

### TASK-013: 命名規則統一

**複数ファイル**
**問題**: 命名パターンの不統一

```typescript
currentRoomMessages vs currentRoomId
```

**解決方法**:

- プロジェクト全体の命名規則策定
- ESLintルール追加
  **工数**: 2-3時間

---

## 🗓️ 実装スケジュール

### Week 1: セキュリティ修正

- [✔] TASK-001: window汚染除去
- [✔] TASK-002: localStorage修正
- [ ] TASK-005: ハードコード設定

### Week 2: 構造改善

- [✔] TASK-003: ハンドラー関数分割
- [✔] TASK-004: コンポーネント分割
- [ ] TASK-009: Handler責務分離

### Week 3: ロジック整理

- [✔] TASK-006: ビジネスロジック抽出
- [ ] TASK-007: useEffect最適化
- [ ] TASK-008: Props drilling解消

### Week 4: 品質向上

- [ ] TASK-010: エラーハンドリング
- [ ] TASK-011: 定数化
- [ ] TASK-012: ファイル責務整理
- [ ] TASK-013: 命名規則統一

---

## 📋 タスク管理

各タスクは以下の形式で追跡します：

```markdown
## TASK-XXX: タスク名

- **状態**: [ ] 未着手 / [進行中] / [完了]
- **担当者**:
- **開始日**:
- **完了予定日**:
- **実完了日**:
- **備考**:
```

---

## 🔍 検証方法

### 自動チェック

- ESLint警告ゼロ
- TypeScript型エラーゼロ
- Go lint警告ゼロ
- 全テスト通過

### 手動チェック

- コードレビュー（CLAUDE.md禁止事項準拠）
- 機能動作確認
- パフォーマンス測定

---

## 📚 参考資料

- [CLAUDE.md](../CLAUDE.md) - 禁止事項・推奨事項
- [SOLID原則](https://en.wikipedia.org/wiki/SOLID)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [React Best Practices](https://react.dev/learn/thinking-in-react)

---

**最終更新**: 2025-01-04
**ドキュメント管理者**: Claude Code AI Assistant
