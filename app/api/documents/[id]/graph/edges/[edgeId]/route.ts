import { NextRequest, NextResponse } from 'next/server';
import { GraphExtractor } from '@/services/knowledge-graph/extractor';

interface RouteContext {
  params: Promise<{ id: string; edgeId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { edgeId } = await params;
    if (!edgeId) return NextResponse.json({ error: 'edgeId가 필요합니다.' }, { status: 400 });

    const body = await req.json();
    const { status, confidence } = body;

    const updated = await GraphExtractor.updateEdge(edgeId, { status, confidence });
    return NextResponse.json({ success: true, edge: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '엣지 상태 갱신 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
