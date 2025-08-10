import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://backend:8080';

export async function proxyRequest(request: Request, backendPath: string): Promise<NextResponse> {
    const method = request.method;
    const cookie = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || ''// プロフィールルート用

    const requestHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        cookie,
    };

    if (authHeader) {
        requestHeaders['Authorization'] = authHeader;
    }

    let requestBody: string | undefined;
    if(method === 'POST' || method === 'PUT') {
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

        const setCookie = backendRes.headers.get('set-cookie');
        if (setCookie) {
            response.headers.append('set-cookie', setCookie);
        }

        return response;
    } catch (err) {
        console.error(`Proxy request to ${backendPath} failed:`, err);
        return new NextResponse(JSON.stringify({ message: 'サーバーエラー発生' }),{
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

}