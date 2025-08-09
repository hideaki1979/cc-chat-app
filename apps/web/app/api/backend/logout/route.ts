import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://backend:8080';

export async function POST(request: Request) {
    const cookie = request.headers.get('cookie') || '';
    const backendRes = await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie,
        },
        credentials: 'include',
    });

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
}


