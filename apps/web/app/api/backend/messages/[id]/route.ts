import { proxyRequest } from '../../proxyHandler';

// GET /api/messages/:id - 個別メッセージ取得
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/messages/${id}`);
}

// PUT /api/messages/:id - メッセージ更新
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/messages/${id}`);
}

// DELETE /api/messages/:id - メッセージ削除
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/messages/${id}`);
}
