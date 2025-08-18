# Render デプロイガイド

## 本番環境デプロイ設定

### 1. Renderでの設定変更

#### Dockerfile指定を変更
Renderのサービス設定で以下を変更：

```yaml
# Build & Deploy Settings
Dockerfile Path: apps/api/Dockerfile.prod
```

**重要**: 開発用`Dockerfile`ではなく、本番用`Dockerfile.prod`を指定する

### 2. 環境変数設定

Renderの環境変数設定で以下を設定：

```bash
# データベース接続
DATABASE_URL=postgres://username:password@hostname:port/database_name?sslmode=require

# JWT設定
JWT_SECRET=your-production-jwt-secret-key-here

# サーバー設定
PORT=8080
RUN_MIGRATIONS=true

# その他の本番環境設定
GO_ENV=production
```

### 3. Dockerfileの選択理由

#### 開発用 (`Dockerfile`)
- **用途**: ローカル開発、ホットリロード
- **特徴**: Airツール付き、大きなイメージサイズ (~1GB)
- **ターゲット**: 開発環境

#### 本番用 (`Dockerfile.prod`)
- **用途**: 本番デプロイ、Renderなどのクラウド環境
- **特徴**: マルチステージビルド、軽量 (~98MB)
- **最適化**: セキュリティ、パフォーマンス、サイズ

### 4. マルチステージビルドの利点

```dockerfile
# ビルドステージ（大きな開発ツール含む）
FROM golang:1.24-alpine AS builder
# ... ビルド処理

# 実行ステージ（軽量、実行に必要な最小限）
FROM alpine:latest
# ... 実行環境のみ
```

**利点**:
- **サイズ削減**: 1GB → 98MB (約90%削減)
- **セキュリティ**: 攻撃面の縮小
- **起動速度**: 軽量イメージで高速起動
- **コスト削減**: 転送・ストレージコスト削減

### 5. デプロイフロー

1. **コード更新**: GitHubにプッシュ
2. **自動ビルド**: Renderが`Dockerfile.prod`でビルド
3. **権限処理**: 修正された権限設定で安全に実行
4. **本番デプロイ**: 軽量イメージでサービス開始

### 6. トラブルシューティング

#### ビルドエラーが発生した場合
```bash
# ローカルでテスト
docker build -f Dockerfile.prod -t test-prod .

# ログ確認
docker run --rm test-prod
```

#### データベース接続エラー
- `DATABASE_URL`の形式確認
- `sslmode=require`の設定確認
- データベースの接続許可設定確認

### 7. モニタリング

#### ヘルスチェック
- **エンドポイント**: `GET /health`
- **確認間隔**: 30秒
- **タイムアウト**: 3秒

#### ログ確認
```bash
# Renderダッシュボードでログ確認可能
# または API経由で確認
```

### 8. スケーリング

本番用Dockerfileは軽量なため、以下が可能：
- **高速起動**: インスタンス追加が迅速
- **メモリ効率**: より多くのインスタンスを同じリソースで実行
- **コスト効率**: 転送量とストレージコストを削減

## 設定チェックリスト

- [ ] `Dockerfile Path: apps/api/Dockerfile.prod` に変更
- [ ] 環境変数を本番用に設定
- [ ] データベース接続確認
- [ ] ヘルスチェックの動作確認
- [ ] ログ出力の確認