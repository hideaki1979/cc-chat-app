import { proxyRequest } from '../../../proxyHandler';

// GET /api/chatrooms/:id/messages - メッセージ一覧取得
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/chatrooms/${id}/messages`);
}

// POST /api/chatrooms/:id/messages - メッセージ送信
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/chatrooms/${id}/messages`);
}
