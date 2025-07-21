# apps/api/Dockerfile
FROM golang:1.24-alpine
WORKDIR /app

# 非rootユーザーを作成
RUN addgroup -g 1001 -S golang && \
    adduser -S golang -u 1001 -G golang

# ホットリロードツールairをインストール
RUN go install github.com/air-verse/air@latest

# ヘルスチェックに必要なツールを追加
RUN apk add --no-cache curl

# Goの依存関係を先にインストール
COPY go.mod go.sum ./
RUN go mod download

# ソースコードをコピー
COPY . .

RUN chown -R golang:golang /app
USER golang

# PORTを明示的に指定
EXPOSE 8080

# ヘルスチェックを追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# airを使ってサーバーを起動
CMD ["air"]