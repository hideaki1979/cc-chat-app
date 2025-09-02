import { proxyRequest } from '../../../../proxyHandler';

// DELETE /api/chatrooms/:id/members/:user_id - メンバー削除
export async function DELETE(request: Request, { params }: { params: { id: string; user_id: string } }) {
    return proxyRequest(request, `/api/chatrooms/${params.id}/members/${params.user_id}`);
}