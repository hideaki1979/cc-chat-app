# 🚨 緊急セキュリティタスク

CLAUDE.md禁止事項分析により発見された**即座対応必須**のセキュリティ問題。

## TASK-001: window オブジェクト汚染除去

### 📍 現在の問題コード

**ファイル**: `apps/web/app/stores/auth.ts:287-290`

```typescript
// 🚫 禁止: グローバル変数での状態管理
if (typeof window !== "undefined") {
  window.authStore = useAuthStore; // グローバル汚染
}
```

### 🎯 解決方法

#### Option A: グローバル削除（推奨）

```typescript
// ✅ 解決案A: グローバル汚染を完全除去
// apps/web/app/stores/auth.ts から該当コードを削除

// グローバルアクセスが必要な場合はContext APIを使用
export const AuthContext = createContext<AuthStore | null>(null);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
};
```

#### Option B: 型安全なグローバルアクセス（必要時のみ）

```typescript
// ✅ 解決案B: 型安全なグローバル参照（最終手段）
declare global {
  interface Window {
    authStore?: typeof useAuthStore;
  }
}

// 開発環境のみ
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  window.authStore = useAuthStore;
}
```

### 📋 実装手順

1. [ ] `apps/web/app/stores/auth.ts` から該当コード削除
2. [ ] 必要に応じてContext API実装
3. [ ] 関連する参照箇所の修正
4. [ ] TypeScript型エラー解消
5. [ ] 動作テスト実施

**工数**: 2-4時間
**リスク**: 低（グローバル参照している箇所の特定が必要）

---

## TASK-002: localStorage 直接アクセス修正

### 📍 現在の問題コード

**ファイル**: `apps/web/app/stores/auth.ts:245-262`

```typescript
// 🚫 禁止: 直接DOM操作・localStorage操作
try {
  const storedAuth = localStorage.getItem("auth-storage");
  if (storedAuth) {
    const parsedAuth = JSON.parse(storedAuth);
    // ...
  }
} catch {
  // localStorage解析エラーは無視
}
```

### 🎯 解決方法

#### 専用ストレージユーティリティ作成

```typescript
// ✅ 新規ファイル: apps/web/app/lib/storage.ts
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class SafeLocalStorage implements StorageAdapter {
  private isAvailable(): boolean {
    try {
      return typeof window !== "undefined" && "localStorage" in window;
    } catch {
      return false;
    }
  }

  getItem(key: string): string | null {
    if (!this.isAvailable()) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to get localStorage item: ${key}`, error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.isAvailable()) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Failed to set localStorage item: ${key}`, error);
    }
  }

  removeItem(key: string): void {
    if (!this.isAvailable()) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove localStorage item: ${key}`, error);
    }
  }
}

export const storage = new SafeLocalStorage();

// 型安全なJSON操作
export function getStorageJson<T>(key: string, defaultValue: T): T {
  const item = storage.getItem(key);
  if (!item) return defaultValue;

  try {
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to parse JSON from localStorage: ${key}`, error);
    return defaultValue;
  }
}

export function setStorageJson<T>(key: string, value: T): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to stringify JSON for localStorage: ${key}`, error);
  }
}
```

#### auth.ts での使用方法

```typescript
// ✅ 修正後: apps/web/app/stores/auth.ts
import { getStorageJson } from "../lib/storage";

// initializeAuth関数内で使用
if (typeof window !== "undefined") {
  try {
    const path = window.location.pathname || "";
    const guestOnly = [LOGIN_PAGE_PATH, REGISTER_PAGE_PATH];
    if (guestOnly.some((p) => path.startsWith(p))) {
      set({ isInitialized: true, isLoading: false, error: null });
      return;
    }
  } catch {
    // no-op
  }

  // 🔄 localStorage直接アクセスを安全なユーティリティに変更
  const storedAuth = getStorageJson("auth-storage", null);
  if (storedAuth?.state?.user && storedAuth?.state?.isInitialized) {
    set({
      user: storedAuth.state.user,
      accessToken: storedAuth.state.accessToken,
      isInitialized: true,
      isLoading: false,
      error: null,
    });
    return;
  }
}
```

### 📋 実装手順

1. [ ] `apps/web/app/lib/storage.ts` 作成
2. [ ] SafeLocalStorage クラス実装
3. [ ] JSON操作ユーティリティ実装
4. [ ] auth.ts での localStorage直接アクセス置換
5. [ ] SSR環境での動作テスト
6. [ ] エラーハンドリングテスト

**工数**: 1-2時間
**リスク**: 極低（後方互換性を保ちつつ安全性向上）

---

## ⚡ 緊急対応チェックリスト

### 即座実行（今日中）

- [ ] **TASK-001**: window汚染除去
- [x] **TASK-002**: localStorage修正（auth.tsのlocalStorage参照を削除）
- [ ] 関連テスト実行
- [ ] 本番デプロイ前検証

### セキュリティ検証

- [ ] XSS攻撃耐性テスト
- [ ] CSP（Content Security Policy）準拠確認
- [ ] SSR/静的生成環境での動作確認
- [ ] メモリリーク検査

### 影響範囲確認

- [ ] 認証フロー動作確認
- [ ] ページリロード時の状態保持
- [ ] ログアウト処理の正常動作
- [ ] 複数タブでの状態同期

---

## 🔒 追補: トークンのCookie完全移行計画（フル移行）

### 目的

アクセストークンも httpOnly + Secure + SameSite Cookie に保存し、フロントからは一切参照しない。

### 対応方針

- バックエンド: `Login/Register/Refresh` 時に `access_token` も Set-Cookie。
- ミドルウェア: Cookie由来 `access_token` を優先的に検証（`Authorization`は移行期間のみ併用）。
- フロント: `Authorization` ヘッダー送出を撤廃。全APIで `credentials: 'include'` を維持。
- CSRF: SameSite=Lax/Strictの選定に加え、state-changing APIで二重送信トークン採用。

### 影響

- `apps/api/internal/handlers/auth.go`、`apps/api/internal/middleware/jwt.go`、`apps/web/app/api/backend/proxyHandler.ts`、`apps/web/app/stores/auth.ts`。

### 検証

- E2E（ログイン→プロフィール取得→メッセージ送信）
- CSRFシナリオ（外部オリジンからのPOST拒否）

---

## 📞 エスカレーション

以下の場合は即座にエスカレーション：

- 🔴 **本番環境でのセキュリティインシデント発生**
- 🔴 **修正により認証システムが完全停止**
- 🟡 **予想工数を大幅に超過（8時間以上）**
- 🟡 **関連システムへの予期しない影響**

**緊急連絡先**: プロジェクトマネージャー・セキュリティチーム

---

**作成日**: 2025-01-04
**優先度**: 🚨 CRITICAL
**期限**: 24時間以内
