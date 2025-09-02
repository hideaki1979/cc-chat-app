import { proxyRequest } from '../../../../proxyHandler';

// DELETE /api/chatrooms/:id/members/:userId - メンバー削除
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
    const { id, userId } = await params;
    return proxyRequest(request, `/api/chatrooms/${id}/members/${userId}`);
}
