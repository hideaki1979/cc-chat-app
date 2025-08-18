declare global {
    interface Headers {
        /** undici の拡張メソッド: 複数の Set-Cookie ヘッダーを配列で取得 */
        getSetCookie(): string[];
    }
}