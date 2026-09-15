import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeFabricService } from '@/services/knowledge-graph/fabric-service';
import { DomainType } from '@/types/rag';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain') as DomainType | null;

    const tree = await KnowledgeFabricService.getCategoryTree(domain || undefined);
    return NextResponse.json({ success: true, tree });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '카테고리 트리 조회 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
