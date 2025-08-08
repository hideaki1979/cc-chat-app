# DevContainer用のマルチ言語開発環境
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# 環境変数（プロジェクトのpackage.jsonに合わせて設定）
ENV NODE_VERSION=18
ENV GO_VERSION=1.24.5
ENV PNPM_VERSION=9.0.0

# ツールのバージョン（再現性確保のため固定）
ENV GOPLS_VERSION=v0.17.1
ENV DELVE_VERSION=v1.24.0
ENV STATICCHECK_VERSION=2024.1.1
ENV AIR_VERSION=v1.61.5

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

# Go 開発ツールのインストール（バージョン固定で再現性確保）
RUN go install golang.org/x/tools/gopls@${GOPLS_VERSION} \
    && go install github.com/go-delve/delve/cmd/dlv@${DELVE_VERSION} \
    && go install honnef.co/go/tools/cmd/staticcheck@${STATICCHECK_VERSION} \
    && go install github.com/cosmtrek/air@${AIR_VERSION}

# Ent（ORM）開発ツール - プロジェクトで使用中
RUN go install entgo.io/ent/cmd/ent@v0.14.4

# その他の開発支援ツール
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.59.1

# 作業ディレクトリの設定
WORKDIR /workspace

# 開発環境用の便利なエイリアスとヘルパー
RUN echo 'alias ll="ls -la"' >> /home/vscode/.bashrc \
    && echo 'alias la="ls -la"' >> /home/vscode/.bashrc \
    && echo 'alias ..="cd .."' >> /home/vscode/.bashrc \
    && echo 'export PATH=$PATH:/go/bin' >> /home/vscode/.bashrc \
    && echo 'alias go-build="go build"' >> /home/vscode/.bashrc \
    && echo 'alias go-test="go test ./..."' >> /home/vscode/.bashrc \
    && echo 'alias go-lint="golangci-lint run"' >> /home/vscode/.bashrc \
    && echo 'alias ent-gen="go generate ./ent"' >> /home/vscode/.bashrc \
    && echo 'alias pnpm-dev="pnpm dev"' >> /home/vscode/.bashrc \
    && echo 'alias pnpm-build="pnpm build"' >> /home/vscode/.bashrc

# ユーザーディレクトリの所有権を設定
RUN chown -R vscode:vscode /home/vscode 