import { NextRequest } from 'next/server';
import { proxyRequest } from '../../proxyHandler';

export async function POST(request: NextRequest) {
  return proxyRequest(request, '/api/chatrooms/dm');
}