import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://backend:8080';

export async function proxyRequest(request: Request, backendPath: string): Promise<NextResponse> {
    const method = request.method;
    const cookie = request.headers.get('cookie') || '';
    // Authorization ヘッダ転送削除（Cookie完全移行のため）

    // フロントエンドからバックエンドへ転送するヘッダーを準備
    // 認証情報はCookieで管理されるため、Authorizationヘッダーは不要
    const requestHeaders: Record<string, string> = { cookie };
    const incomingContentType = request.headers.get('content-type');
    if (incomingContentType) {
        requestHeaders['Content-Type'] = incomingContentType;
    }
    const incomingAccept = request.headers.get('accept');
    if (incomingAccept) {
        requestHeaders['Accept'] = incomingAccept;
    }

    // Authorization ヘッダ転送を削除（access_token は Cookie で送信される）

    // CSRF保護のためのトークンをヘッダーまたはCookieから取得
    // セキュリティ強化のため、二重送信トークンパターンを実装
    let csrfHeader = request.headers.get('x-csrf-token') || request.headers.get('X-CSRF-Token');
    if (!csrfHeader && cookie) {
        // ヘッダが無い場合はクッキーから抽出（フォールバック対応）
        const match = cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
        if (match && match[1]) {
            try {
                // URLエンコードされている可能性があるためデコードを試行
                csrfHeader = decodeURIComponent(match[1]);
            } catch {
                // デコードに失敗した場合は元の値をそのまま使用
                csrfHeader = match[1];
            }
        }
    }
    if (csrfHeader) {
        requestHeaders['X-CSRF-Token'] = csrfHeader;
    }

    // リクエストボディの処理（データ変更系のHTTPメソッドのみ）
    let requestBody: string | undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        requestBody = await request.text();
    }

    // バックエンドへのリクエスト設定を構築
    const fetchOptions: RequestInit = {
        method: method,
        headers: requestHeaders,
        credentials: 'include',  // Cookieの自動送受信を有効化
    }

    if (requestBody) {
        fetchOptions.body = requestBody;
    }

    try {
        const incomingUrl = new URL(request.url);
        // タイムアウト制御（10秒）- 長時間のリクエストを防止
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        // バックエンドのフルURLを構築（クエリパラメータも含む）
        const backendUrl = `${BACKEND_URL}${backendPath}${incomingUrl.search}`
        const backendRes = await fetch(backendUrl, { ...fetchOptions, signal: controller.signal });
        clearTimeout(timeoutId);
        const bodyText = await backendRes.text();
        const response = new NextResponse(bodyText, {
            status: backendRes.status,
            headers: {
                'Content-Type': backendRes.headers.get('content-type') || 'application/json',
            },
        });

        // Set-Cookieヘッダーの処理（複数Cookie対応）
        // undiciのgetSetCookie()拡張があれば使用、なければ従来のget()で取得
        const setCookies: string[] | undefined = backendRes.headers.getSetCookie?.();
        if (Array.isArray(setCookies) && setCookies.length > 0) {
            // 複数のSet-Cookieヘッダーがある場合の処理
            for (const sc of setCookies) {
                // Docker環境でのCookie問題を修正: localhost:3003でアクセス可能にする
                let fixedCookie = sc;
                // refresh_tokenのCookieの場合、Domainを明示的にlocalhostに設定
                if (sc.includes('refresh_token')) {
                    // 既存のDomain指定を除去(ホスト限定クッキーにする)
                    // これにより、localhost:3003からもCookieにアクセス可能になる
                    fixedCookie = sc.replace(/;\s*Domain=[^;]*/, '');
                }
                response.headers.append('set-cookie', fixedCookie);
            }
        } else {
            // 従来のヘッダー取得方法（フォールバック）
            const sc = backendRes.headers.get('set-cookie');
            if (sc) {
                // Docker環境でのCookie問題を修正: localhost:3003でアクセス可能にする
                let fixedCookie = sc;
                // refresh_tokenのCookieの場合、Domainを明示的にlocalhostに設定
                if (sc.includes('refresh_token')) {
                    // 既存のDomain指定を除去してlocalhostを設定
                    // プロキシを経由することでCookieドメインの問題を解決
                    fixedCookie = sc.replace(/;\s*Domain=[^;]*/, '');
                }
                response.headers.append('set-cookie', fixedCookie);
            }
        }

        // Optionally forward selected headers
        const wwwAuth = backendRes.headers.get('www-authenticate');
        if (wwwAuth) response.headers.set('www-authenticate', wwwAuth);
        const cacheCtl = backendRes.headers.get('cache-control');
        if (cacheCtl) response.headers.set('cache-control', cacheCtl);

        return response;
    } catch (err) {
        // タイムアウトエラーの処理（AbortController.abort()によるもの）
        if (err instanceof DOMException && err.name === 'AbortError') {
            return new NextResponse(JSON.stringify({ message: "Upstream timeout." }), {
                status: 504,  // Gateway Timeout
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            });
        }
        // その他の通信エラー（ネットワーク障害、接続拒否など）
        console.error(`Proxy request to ${backendPath} failed:`, err);
        return new NextResponse(JSON.stringify({ message: 'サーバーエラー発生' }), {
            status: 500,  // Internal Server Error
            headers: { 'Content-Type': 'application/json' },
        })
    }

}