declare global {
    interface Headers {
        /** Node.js/undici 環境のみ: 複数の Set-Cookie ヘッダーを配列で取得（ブラウザでは未定義） */
        getSetCookie(): string[];
    }
}

export {};
