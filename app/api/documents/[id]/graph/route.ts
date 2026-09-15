import { NextRequest, NextResponse } from 'next/server';
import { GraphExtractor } from '@/services/knowledge-graph/extractor';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });

    const graph = await GraphExtractor.getGraphForDocument(id);
    return NextResponse.json({ success: true, ...graph });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '그래프 조회 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
