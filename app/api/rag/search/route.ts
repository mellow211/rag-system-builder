import { NextRequest, NextResponse } from 'next/server';
import { vectorSearchService } from '@/services/retrieval/vector-search';
import { DomainType } from '@/types/rag';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, query, topK, filters, threshold } = body;

    if (!domain || !query) {
      return NextResponse.json(
        { error: 'domain과 query(검색 질문)는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    const validDomains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];
    if (!validDomains.includes(domain)) {
      return NextResponse.json(
        { error: '유효하지 않은 도메인입니다.' },
        { status: 400 }
      );
    }

    const result = await vectorSearchService.search({
      domain,
      query,
      topK: topK ? parseInt(topK, 10) : 5,
      threshold: threshold !== undefined ? parseFloat(threshold) : -1.0,
      filters: filters || {},
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('검색 실행 API 오류:', err);
    const message = err instanceof Error ? err.message : '검색 처리 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
