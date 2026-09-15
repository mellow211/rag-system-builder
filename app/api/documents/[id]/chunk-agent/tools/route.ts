import { NextRequest, NextResponse } from 'next/server';
import { ChunkAgentTools } from '@/services/chunking-agent/tools';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });

    const body = await req.json();
    const { toolName, params: toolParams = {} } = body;

    let result: unknown = null;

    switch (toolName) {
      case 'splitSection':
        result = await ChunkAgentTools.splitSection(
          id,
          toolParams.proposalId as string,
          (toolParams.subTitles as string[]) || []
        );
        break;
      case 'mergeChunks':
        result = await ChunkAgentTools.mergeChunks(
          id,
          toolParams.proposalIds as string[],
          toolParams.newTitle as string
        );
        break;
      case 'renameChunk':
        result = await ChunkAgentTools.renameChunk(
          id,
          toolParams.proposalId as string,
          toolParams.newTitle as string
        );
        break;
      case 'changeChunkCategory':
        result = await ChunkAgentTools.changeChunkCategory(
          id,
          toolParams.proposalId as string,
          toolParams.newCategory as string
        );
        break;
      case 'setChunkType':
        result = await ChunkAgentTools.setChunkType(
          id,
          toolParams.proposalId as string,
          toolParams.newType as string
        );
        break;
      case 'previewChunkPlan':
        result = await ChunkAgentTools.previewChunkPlan(id);
        break;
      case 'analyzeDocumentStructure':
        result = await ChunkAgentTools.analyzeDocumentStructure(id);
        break;
      default:
        return NextResponse.json({ error: `알 수 없는 도구: ${toolName}` }, { status: 400 });
    }

    const proposals = await ChunkAgentTools.getProposals(id);
    const summary = await ChunkAgentTools.previewChunkPlan(id);

    return NextResponse.json({
      success: true,
      toolName,
      result,
      proposals,
      summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '도구 실행 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
