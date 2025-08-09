import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://backend:8080';

export async function POST(request: Request) {
    const cookie = request.headers.get('cookie') || '';
    const body = await request.text();
    const backendRes = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie,
        },
        body,
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


