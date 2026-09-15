import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeFabricService } from '@/services/knowledge-graph/fabric-service';
import { DomainType } from '@/types/rag';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain') as DomainType | null;

    const data = await KnowledgeFabricService.getGlobalFabricGraph(domain || undefined);
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '지식 패브릭 그래프 조회 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
