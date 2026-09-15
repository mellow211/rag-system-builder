import { NextRequest, NextResponse } from 'next/server';
import { ChunkAgentTools } from '@/services/chunking-agent/tools';

interface RouteContext {
  params: Promise<{ id: string; proposalId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id, proposalId } = await params;
    if (!id || !proposalId) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const updates = await req.json();
    const proposals = await ChunkAgentTools.getProposals(id);
    const target = proposals.find((p) => p.id === proposalId);

    if (!target) {
      return NextResponse.json({ error: '청크 제안을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (updates.title !== undefined) target.title = updates.title;
    if (updates.category !== undefined) target.category = updates.category;
    if (updates.chunk_type !== undefined) target.chunk_type = updates.chunk_type;
    if (updates.proposed_content !== undefined) target.proposed_content = updates.proposed_content;
    if (updates.status !== undefined) target.status = updates.status;
    else target.status = 'EDITED';

    await ChunkAgentTools.saveProposals(id, proposals);

    return NextResponse.json({ success: true, proposal: target });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '수정 처리 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
