import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://backend:8080';

export async function GET(request: Request) {
    const cookie = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';
    const backendRes = await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            cookie,
            Authorization: authHeader,
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

    return response;
}


