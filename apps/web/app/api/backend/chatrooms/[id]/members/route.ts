import { proxyRequest } from '../../../proxyHandler';

// POST /api/chatrooms/:id/members - メンバー追加
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/chatrooms/${id}/members`);
}
