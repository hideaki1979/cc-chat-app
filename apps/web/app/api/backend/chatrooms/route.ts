import { proxyRequest } from '../proxyHandler';

// GET /api/chatrooms - チャットルーム一覧取得
export async function GET(request: Request) {
    return proxyRequest(request, '/api/chatrooms');
}

// POST /api/chatrooms - チャットルーム作成
export async function POST(request: Request) {
    return proxyRequest(request, '/api/chatrooms');
}