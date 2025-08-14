import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://backend:8080';

export async function proxyRequest(request: Request, backendPath: string): Promise<NextResponse> {
    const method = request.method;
    const cookie = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || ''// プロフィールルート用


    const requestHeaders: Record<string, string> = {cookie};
    const incomingContentType = request.headers.get('content-type');
    if (incomingContentType) {
        requestHeaders['Content-Type'] = incomingContentType;
    }
    const incomingAccept = request.headers.get('accept');
    if(incomingAccept) {
        requestHeaders['Accept'] = incomingAccept;
    }

    if (authHeader) {
        requestHeaders['Authorization'] = authHeader;
    }

    let requestBody: string | undefined;
    if(['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
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
        const backendRes = await fetch(`${BACKEND_URL}${backendPath}`, fetchOptions);
        const bodyText = await backendRes.text();
        const response = new NextResponse(bodyText, {
            status: backendRes.status,
            headers: {
                'Content-Type': backendRes.headers.get('content-type') || 'application/json',
            },
        });

        // Set-Cookie: handle multiple headers (undici extension), fallback to single
        // @ts-ignore - getSetCookie is non-standard but available in undici/Next runtime
        const setCookies: string[] | undefined = backendRes.headers.getSetCookie?.();
        if(Array.isArray(setCookies) && setCookies.length > 0) {
            for(const sc of setCookies) response.headers.append('set-cookie', sc);
        } else {
            const sc = backendRes.headers.get('set-cookie');
            if(sc) response.headers.append('set-cookie', sc);
        }

        // Optionally forward selected headers
        const wwwAuth = backendRes.headers.get('www-authenticate');
        if (wwwAuth) response.headers.set('www-authenticate', wwwAuth);
        const cacheCtl = backendRes.headers.get('cache-control');
        if (cacheCtl) response.headers.set('cache-control', cacheCtl);

        return response;
    } catch (err) {
        console.error(`Proxy request to ${backendPath} failed:`, err);
        return new NextResponse(JSON.stringify({ message: 'サーバーエラー発生' }),{
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

}