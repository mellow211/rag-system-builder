import { NextRequest, NextResponse } from 'next/server';
import { ChunkingAgent } from '@/services/chunking-agent/chunking-agent';
import { ChunkAgentTools } from '@/services/chunking-agent/tools';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });

    const body = await req.json();
    const { message } = body;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '대화 메시지를 입력해 주세요.' }, { status: 400 });
    }

    const result = await ChunkingAgent.chat(id, message);
    const structure = await ChunkAgentTools.analyzeDocumentStructure(id);
    const summary = await ChunkAgentTools.previewChunkPlan(id);

    return NextResponse.json({
      success: true,
      session: result.session,
      proposals: result.proposals,
      assistantMessage: result.assistantMessage,
      structure,
      summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '대화 처리 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
