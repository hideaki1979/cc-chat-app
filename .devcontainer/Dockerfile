# DevContainer用のマルチ言語開発環境
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# 環境変数
ENV NODE_VERSION=18
ENV GO_VERSION=1.21
ENV PNPM_VERSION=9.0.0

# システムパッケージのアップデートとインストール
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    unzip \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Node.js のインストール
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs

# pnpm のインストール
RUN npm install -g pnpm@${PNPM_VERSION}

# Go のインストール
RUN wget https://golang.org/dl/go${GO_VERSION}.linux-amd64.tar.gz \
    && wget https://golang.org/dl/go${GO_VERSION}.linux-amd64.tar.gz.sha256 \
    && sha256sum -c go${GO_VERSION}.linux-amd64.tar.gz.sha256 \
    && tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz \
    && rm go${GO_VERSION}.linux-amd64.tar.gz go${GO_VERSION}.linux-amd64.tar.gz.sha256

# Go 環境変数の設定
ENV PATH=/usr/local/go/bin:$PATH
ENV GOPATH=/go
ENV GOPROXY=https://proxy.golang.org,direct

# Go ツールのインストール
RUN go install golang.org/x/tools/gopls@latest \
    && go install github.com/go-delve/delve/cmd/dlv@latest \
    && go install honnef.co/go/tools/cmd/staticcheck@latest

# Air（Go ホットリロード）のインストール
RUN go install github.com/cosmtrek/air@latest

# sqlc のインストール（Go用のSQL生成ツール）
RUN go install github.com/kyleconroy/sqlc/cmd/sqlc@latest

# 作業ディレクトリの設定
WORKDIR /workspace

# bashrc に便利なエイリアスを追加
RUN echo 'alias ll="ls -la"' >> /home/vscode/.bashrc \
    && echo 'alias la="ls -la"' >> /home/vscode/.bashrc \
    && echo 'alias ..="cd .."' >> /home/vscode/.bashrc \
    && echo 'export PATH=$PATH:/go/bin' >> /home/vscode/.bashrc

# ユーザーディレクトリの所有権を設定
RUN chown -R vscode:vscode /home/vscode 