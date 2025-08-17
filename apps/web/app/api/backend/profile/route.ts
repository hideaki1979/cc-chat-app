import { proxyRequest } from '../proxyHandler';

export async function GET(request: Request) {
    return proxyRequest(request, '/api/profile');
}

export async function POST(request: Request) {
    return proxyRequest(request, '/auth/profile');
}
