import { proxyRequest } from '../proxyHandler';

export async function GET(request: Request) {
    return proxyRequest(request, '/csrf');
}