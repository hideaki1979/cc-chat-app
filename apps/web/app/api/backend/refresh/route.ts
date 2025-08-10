import { proxyRequest } from '../proxyHandler';

export async function POST(request: Request) {
    return proxyRequest(request, '/auth/refresh');
}
