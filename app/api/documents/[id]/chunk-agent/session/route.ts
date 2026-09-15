import { NextRequest, NextResponse } from 'next/server';
import { ChunkingAgent } from '@/services/chunking-agent/chunking-agent';
import { ChunkAgentTools } from '@/services/chunking-agent/tools';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });

    const data = await ChunkingAgent.initSession(id);
    const structure = await ChunkAgentTools.analyzeDocumentStructure(id);
    const summary = await ChunkAgentTools.previewChunkPlan(id);

    return NextResponse.json({
      success: true,
      session: data.session,
      proposals: data.proposals,
      structure,
      summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '세션 조회 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return GET(req, { params });
}
