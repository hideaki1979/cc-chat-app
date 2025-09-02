import { proxyRequest } from '../../proxyHandler';

// GET /api/messages/:id - メッセージ詳細取得
export async function GET(request: Request, { params }: { params: { id: string } }) {
    return proxyRequest(request, `/api/messages/${params.id}`);
}

// PUT /api/messages/:id - メッセージ更新
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    return proxyRequest(request, `/api/messages/${params.id}`);
}

// DELETE /api/messages/:id - メッセージ削除
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    return proxyRequest(request, `/api/messages/${params.id}`);
}