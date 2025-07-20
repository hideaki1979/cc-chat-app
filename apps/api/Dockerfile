# apps/api/Dockerfile
FROM golang:1.24-alpine
WORKDIR /app

# ホットリロードツールairをインストール
RUN go install github.com/air-verse/air@latest

# Goの依存関係を先にインストール
COPY go.mod go.sum ./
RUN go mod download

# ソースコードをコピー
COPY . .

# PORTを明示的に指定
EXPOSE 8080

# ヘルスチェックを追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# airを使ってサーバーを起動
CMD ["air"]