import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://backend:8080';

export async function proxyRequest(request: Request, backendPath: string): Promise<NextResponse> {
    const method = request.method;
    const cookie = request.headers.get('cookie') || '';
    // Authorization ヘッダ転送削除（Cookie完全移行のため）

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

    // Forward CSRF header when present
    let csrfHeader = request.headers.get('x-csrf-token') || request.headers.get('X-CSRF-Token');
    if (!csrfHeader && cookie) {
        // ヘッダが無い場合はクッキーから抽出
        const parts = cookie.split(';');
        for (const part of parts) {
            const [k, v] = part.split('=');
            if (k && k.trim() === 'csrf_token' && typeof v === 'string') {
                csrfHeader = v.trim();
                break;
            }
        }
    }
    if (csrfHeader) {
        requestHeaders['X-CSRF-Token'] = csrfHeader;
    }

    let requestBody: string | undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        requestBody = await request.text();
    }

    const fetchOptions: RequestInit = {
        method: method,
        headers: requestHeaders,
        credentials: 'include',
    }

    if (requestBody) {
        fetchOptions.body = requestBody;
    }

    try {
        const incomingUrl = new URL(request.url);
        // Abort制御（10秒）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        // URL生成
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

        // Set-Cookie: handle multiple headers (undici extension), fallback to single
        const setCookies: string[] | undefined = backendRes.headers.getSetCookie?.();
        if (Array.isArray(setCookies) && setCookies.length > 0) {
            for (const sc of setCookies) {
                // Docker環境でのCookie問題を修正: localhost:3003でアクセス可能にする
                let fixedCookie = sc;
                // refresh_tokenのCookieの場合、Domainを明示的にlocalhostに設定
                if (sc.includes('refresh_token')) {
                    // 既存のDomain指定を除去(ホスト限定クッキーにする)
                    fixedCookie = sc.replace(/;\s*Domain=[^;]*/, '');
                }
                response.headers.append('set-cookie', fixedCookie);
            }
        } else {
            const sc = backendRes.headers.get('set-cookie');
            if (sc) {
                // Docker環境でのCookie問題を修正: localhost:3003でアクセス可能にする
                let fixedCookie = sc;
                // refresh_tokenのCookieの場合、Domainを明示的にlocalhostに設定
                if (sc.includes('refresh_token')) {
                    // 既存のDomain指定を除去してlocalhostを設定
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
        if (err instanceof DOMException && err.name === 'AbortError') {
            return new NextResponse(JSON.stringify({ message: "Upstream timeout." }), {
                status: 504,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            });
        }
        console.error(`Proxy request to ${backendPath} failed:`, err);
        return new NextResponse(JSON.stringify({ message: 'サーバーエラー発生' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

}