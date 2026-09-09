import { NextRequest, NextResponse } from 'next/server';
import { advancedSearchService, SearchPipelineMode } from '@/services/retrieval/advanced-search';
import { DomainType } from '@/types/rag';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, domains, query, topK, mode = 'advanced-v2', filters, options, threshold } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query(검색 질문)는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    const validDomains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];
    
    // 도메인 유효성 검증 (단일 도메인 또는 다중 도메인 배열)
    let validatedDomains: DomainType[] | undefined = undefined;
    if (Array.isArray(domains) && domains.length > 0) {
      validatedDomains = domains.filter((d) => validDomains.includes(d));
    }

    let validatedDomain: DomainType | undefined = undefined;
    if (domain && validDomains.includes(domain)) {
      validatedDomain = domain;
    }

    if (!validatedDomain && (!validatedDomains || validatedDomains.length === 0)) {
      return NextResponse.json(
        { error: '유효한 검색 대상 도메인(domain 또는 domains)을 지정해 주세요.' },
        { status: 400 }
      );
    }

    const result = await advancedSearchService.search({
      domain: validatedDomain,
      domains: validatedDomains,
      query: query.trim(),
      topK: topK ? parseInt(topK, 10) : 5,
      mode: (mode as SearchPipelineMode) || 'advanced-v2',
      filters: filters || {},
      options: options || {},
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Advanced RAG search API error:', err);
    const message = err instanceof Error ? err.message : '검색 처리 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
