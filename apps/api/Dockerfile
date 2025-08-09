# apps/api/Dockerfile
FROM golang:1.24-alpine
WORKDIR /app

# 非rootユーザーを作成
RUN addgroup -g 1001 -S golang && \
    adduser -S golang -u 1001 -G golang

# ヘルスチェックに必要なツールを追加（root）
RUN apk add --no-cache curl git

# GOPATHとGoモジュールキャッシュのディレクトリ権限を設定（root）
RUN mkdir -p /go/pkg /go/bin && \
    chown -R golang:golang /go

# 非rootユーザーに切り替え
USER golang

# ホットリロードツールairをインストール（非rootで実行してキャッシュ権限問題を回避）
# 再現性のためにバージョン固定（必要に応じて更新）
ARG AIR_VERSION=latest
RUN go install github.com/air-verse/air@${AIR_VERSION}

# Goの依存関係を先にインストール
COPY --chown=golang:golang go.mod go.sum ./
RUN go mod download

# ソースコードをコピー
COPY --chown=golang:golang . .

# airが使用するtmpディレクトリを作成
RUN mkdir -p tmp && chmod 755 tmp

# PORTを明示的に指定
EXPOSE 8080

# ヘルスチェックを追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# airを使ってサーバーを起動
CMD ["air"]