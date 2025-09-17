import { proxyRequest } from '../proxyHandler';

export async function GET(request: Request) {
    return proxyRequest(request, '/csrf');
}

import { proxyRequest } from '../proxyHandler';

export async function GET(request: Request): Promise<Response> {
    return proxyRequest(request, '/csrf');
}