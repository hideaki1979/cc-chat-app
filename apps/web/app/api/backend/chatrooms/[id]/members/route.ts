import { proxyRequest } from '../../../proxyHandler';

// POST /api/chatrooms/:id/members - メンバー追加
export async function POST(request: Request, { params }: { params: { id: string } }) {
    return proxyRequest(request, `/api/chatrooms/${params.id}/members`);
}