# apps/web/Dockerfile
# ベースとなるNode.jsのバージョンを指定
FROM node:22-alpine AS builder

# コンテナ内の作業ディレクトリを設定
WORKDIR /app

# Corepackを有効化してpnpmを使えるようにする
RUN corepack enable pnpm

# monorepoの設定ファイルをコピー
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# packagesディレクトリ全体をコピー
COPY packages/ ./packages/

# apps/webのpackage.jsonをコピー
COPY apps/web/package.json ./apps/web/

# 依存関係をインストール（プロジェクトルートで実行）
RUN pnpm install

# ソースコードをコピー
COPY . .

# webアプリのディレクトリに移動
WORKDIR /app/apps/web

# 本番ビルド用のステージ
FROM builder AS production
RUN pnpm run build

# 開発用のステージ
FROM builder AS development

# 非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

RUN chown -R nextjs:nodejs /app
USER nextjs

# ポートを明示的に指定
EXPOSE 3003

# 開発サーバーを起動
CMD ["pnpm", "run", "dev"]