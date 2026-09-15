import { NextRequest, NextResponse } from 'next/server';
import { GraphExtractor } from '@/services/knowledge-graph/extractor';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });

    const graph = await GraphExtractor.extractFromDocument(id);
    return NextResponse.json({
      success: true,
      message: `총 ${graph.nodes.length}개 노드 및 ${graph.edges.length}개 관계가 추출되었습니다.`,
      ...graph,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '그래프 추출 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
