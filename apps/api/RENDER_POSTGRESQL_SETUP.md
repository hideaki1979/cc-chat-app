# Render PostgreSQL + アプリサーバー構築ガイド

## 🎯 概要
RenderでPostgreSQLデータベースとGoアプリケーションサーバーを構築する完全ガイド

## 📋 構築手順

### 1. PostgreSQLサービス作成

#### Step 1: Renderダッシュボードでデータベース作成
1. **Renderダッシュボード**: https://dashboard.render.com/ にアクセス
2. **New +** ボタン → **PostgreSQL** を選択
3. **データベース設定**:
   ```yaml
   Name: cc-chat-database
   Database: cc_chat_db
   User: cc_chat_user
   Region: Singapore (Asia推奨) または Oregon (US West)
   PostgreSQL Version: 15 (推奨)
   Plan: Free Tier ($0/month) または Starter ($7/month)
   ```

#### Step 2: データベース作成完了待ち
- 作成には数分かかります
- **Status: Available** になるまで待機

### 2. データベース接続情報取得

#### Step 1: 内部接続文字列を取得
PostgreSQLサービス詳細ページで以下を確認：

```bash
# Internal Database URL (Render内部ネットワーク用)
postgresql://cc_chat_user:password@dpg-xxxxxxxxx:5432/cc_chat_db

# External Database URL (外部接続用)
postgresql://cc_chat_user:password@dpg-xxxxxxxxx.oregon-postgres.render.com:5432/cc_chat_db
```

**重要**: アプリサーバーには **Internal URL** を使用（高速・無料）

#### Step 2: 接続パラメータ確認
```yaml
Host: dpg-xxxxxxxxx (Internal用)
Port: 5432
Database: cc_chat_db
Username: cc_chat_user
Password: [自動生成されたパスワード]
SSL Mode: require
```

### 3. Goアプリサーバーの環境変数設定

#### Step 1: Webサービスの環境変数設定
Goアプリサーバーの **Environment Variables** で設定：

```bash
# データベース接続（Internal URLを使用）
DATABASE_URL=postgresql://cc_chat_user:GENERATED_PASSWORD@dpg-XXXXX:5432/cc_chat_db?sslmode=require

# アプリケーション設定
JWT_SECRET=your-super-secure-jwt-secret-key-for-production
RUN_MIGRATIONS=true
# PORT=8080  # ← Renderが自動設定するため不要

# 環境識別
GO_ENV=production

# CORS設定（フロントエンドURLを指定）
FRONTEND_URL=https://your-frontend-app.onrender.com

# タイムゾーン設定
TZ=Asia/Tokyo
```

#### Step 2: 環境変数の値例
```bash
# 実際の例（パスワードとIDは実際の値に置き換え）
DATABASE_URL=postgresql://cc_chat_user:ABC123xyz789@dpg-ch4k5l6m7n8o:5432/cc_chat_db?sslmode=require
JWT_SECRET=super-secret-jwt-key-2024-production-render
RUN_MIGRATIONS=true
GO_ENV=production
FRONTEND_URL=https://your-frontend-app.onrender.com
TZ=Asia/Tokyo

# 注意: PORTはRenderが自動設定するため明示的な設定は不要
```

### 4. データベース初期化設定

#### Step 1: Goアプリの起動時マイグレーション確認
現在の設定ファイルを確認：

```go
// main.go でのマイグレーション実行確認
if os.Getenv("RUN_MIGRATIONS") == "true" {
    // Entスキーママイグレーション実行
    if err := client.Schema.Create(ctx); err != nil {
        log.Fatalf("Failed to create database schema: %v", err)
    }
}
```

#### Step 2: 初回デプロイ手順
1. **PostgreSQLサービス作成完了確認**
2. **環境変数設定完了**
3. **Goアプリサーバー再デプロイ実行**
4. **ログでマイグレーション成功確認**

### 5. セキュリティ設定

#### Step 1: データベースアクセス制限
```yaml
Allowed IPs: 
  - Render Services Only (デフォルト推奨)
  - 開発者IP追加 (必要に応じて)
```

#### Step 2: 接続暗号化
```bash
# SSL設定必須
sslmode=require
```

### 6. 接続テスト

#### Step 1: ローカル接続テスト（オプション）
```bash
# External URLを使用してローカルからテスト
psql "postgresql://cc_chat_user:PASSWORD@dpg-XXXXX.oregon-postgres.render.com:5432/cc_chat_db?sslmode=require"
```

#### Step 2: アプリケーション接続確認
```bash
# ヘルスチェックエンドポイントで確認
curl https://your-app.onrender.com/health
```

### 7. トラブルシューティング

#### 一般的なエラーと解決策

**❌ `connection refused`**
```bash
# 原因: 接続文字列が間違っている
# 解決: Internal URLを使用しているか確認
DATABASE_URL=postgresql://cc_chat_user:PASSWORD@dpg-XXXXX:5432/cc_chat_db?sslmode=require
```

**❌ `authentication failed`**
```bash
# 原因: パスワードまたはユーザー名が間違っている
# 解決: Render PostgreSQLサービスページで正確な情報を確認
```

**❌ `database does not exist`**
```bash
# 原因: データベース名が間違っている
# 解決: 正しいデータベース名を確認
Database: cc_chat_db
```

**❌ `SSL connection required`**
```bash
# 原因: SSL設定が不足
# 解決: 接続文字列に sslmode=require を追加
```

#### デバッグコマンド
```bash
# 1. アプリサーバーのログ確認
# Renderダッシュボード → Webサービス → Logs

# 2. データベース接続情報確認
# Renderダッシュボード → PostgreSQL → Connect

# 3. 環境変数確認
# Renderダッシュボード → Webサービス → Environment
```

### 8. 本番運用設定

#### Step 1: バックアップ設定
```yaml
# Render PostgreSQL自動バックアップ
Backup Retention: 7 days (Free Tier)
Daily Backups: 自動実行
```

#### Step 2: モニタリング
```yaml
# データベースメトリクス
- Connection Count
- Query Performance
- Storage Usage

# アプリケーションメトリクス
- Response Time
- Error Rate
- Memory Usage
```

#### Step 3: スケーリング準備
```yaml
# データベースアップグレード
Free → Starter ($7/month): より多い接続、高性能
Starter → Pro ($20/month): 高可用性、より大きなストレージ

# アプリサーバースケーリング
Instance Type: Starter → Standard
Auto-scaling: 有効化
```

## 🔗 設定完了チェックリスト

### PostgreSQLサービス
- [ ] データベース作成完了 (Status: Available)
- [ ] Internal Database URL取得
- [ ] 接続パラメータ確認

### Goアプリサーバー
- [ ] 環境変数 `DATABASE_URL` 設定 (Internal URL使用)
- [ ] 環境変数 `JWT_SECRET` 設定
- [ ] 環境変数 `RUN_MIGRATIONS=true` 設定
- [ ] その他必要な環境変数設定

### デプロイ確認
- [ ] アプリサーバー再デプロイ実行
- [ ] ログでデータベース接続成功確認
- [ ] ヘルスチェックエンドポイント動作確認
- [ ] マイグレーション成功確認

### セキュリティ
- [ ] SSL接続有効 (`sslmode=require`)
- [ ] 本番用JWT秘密鍵設定
- [ ] データベースアクセス制限設定

## 🚀 次のステップ

1. **フロントエンド接続**: Next.jsアプリをGoアプリに接続
2. **ドメイン設定**: カスタムドメインの設定
3. **HTTPS化**: SSL証明書の自動設定
4. **モニタリング**: エラー追跡とパフォーマンス監視