import { proxyRequest } from '../../proxyHandler';

// GET /api/chatrooms/:id - チャットルーム詳細取得
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/chatrooms/${id}`);
}

// PUT /api/chatrooms/:id - チャットルーム更新
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/chatrooms/${id}`);
}
