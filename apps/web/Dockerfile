# apps/web/Dockerfile
# ベースとなるNode.jsのバージョンを指定
FROM node:22-alpine as builder

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

# 依存関係をインストール
RUN pnpm install

# ソースコードをコピー
COPY . .

# webアプリのディレクトリに移動
WORKDIR /app/apps/web

# 開発サーバーを起動
CMD ["pnpm", "run", "dev"]