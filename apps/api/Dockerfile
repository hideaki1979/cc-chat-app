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

# airを使ってサーバーを起動
CMD ["air"]