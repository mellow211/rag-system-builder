import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getEmbeddingProvider } from '@/lib/embedding';
import { getProjectByDomain } from '@/lib/supabase/projects';
import { DomainType, SearchResultItem } from '@/types/rag';

export interface SearchFilters {
  documentType?: string;
  source?: string;
  year?: string;
}

export interface VectorSearchParams {
  domain: DomainType;
  query: string;
  topK?: number;
  threshold?: number;
  filters?: SearchFilters;
}

export interface VectorSearchResult {
  query: string;
  domain: DomainType;
  topK: number;
  results: SearchResultItem[];
  executionTimeMs: number;
}

export class VectorSearchService {
  async search(params: VectorSearchParams): Promise<VectorSearchResult> {
    const startTime = Date.now();
    const { domain, query, topK = 5, threshold = -1.0, filters = {} } = params;

    if (!query || query.trim().length === 0) {
      throw new Error('검색 질문을 입력해 주세요.');
    }

    const project = await getProjectByDomain(domain);
    if (!project) {
      throw new Error(`도메인 프로젝트를 찾을 수 없습니다: ${domain}`);
    }

    // 1. 사용자 질문 텍스트 임베딩 생성
    const embeddingProvider = getEmbeddingProvider();
    const queryEmbedding = await embeddingProvider.embedText(query.trim());

    if (!isSupabaseAdminConfigured()) {
      // Supabase 미연동 시 테스트용 Mock 유사도 결과 반환
      const mockResults: SearchResultItem[] = [
        {
          id: 'mock-chunk-1',
          document_id: 'mock-doc-1',
          rag_project_id: project.id,
          chunk_index: 0,
          similarity: 0.9245,
          document_title: `${project.name} 관련 임상 가이드라인`,
          document_source: '대한노인의학회',
          metadata: {
            page: 12,
            source: '대한노인의학회',
            document_type: '가이드라인',
            char_length: 320,
          },
          content: `질문 "${query}"에 대한 ${project.name} 지식 청크 근거 내용입니다. 고령자의 경우 일주기리듬과 규칙적인 수면-각성 주기가 멜라토닌 분비 및 심혈관 항상성에 중대한 영향을 미칩니다. 아침 기상 직후 30분 이상의 자연광 노출이 권고됩니다.`,
        },
        {
          id: 'mock-chunk-2',
          document_id: 'mock-doc-1',
          rag_project_id: project.id,
          chunk_index: 1,
          similarity: 0.8512,
          document_title: `${project.name} 관리 표준 지침서`,
          document_source: '질병관리청',
          metadata: {
            page: 15,
            source: '질병관리청',
            document_type: '공공기관 자료',
            char_length: 280,
          },
          content: `노년기 수면 장애 예방을 위해서는 취침 전 카페인 섭취를 지양하고, 일정한 온습도(섭씨 20~22도, 습도 50%)를 유지하는 것이 숙면에 필수적입니다.`,
        },
        {
          id: 'mock-chunk-3',
          document_id: 'mock-doc-2',
          rag_project_id: project.id,
          chunk_index: 0,
          similarity: 0.7891,
          document_title: '고령자 건강 증진을 위한 섭생과 일상 수칙',
          document_source: '보건복지부',
          metadata: {
            page: 4,
            source: '보건복지부',
            document_type: '내부 문서',
            char_length: 290,
          },
          content: `균형 잡힌 영양 공급과 더불어 일정한 식사 시간을 유지함으로써 소화기계의 생체시계 동기화를 유도할 수 있습니다.`,
        },
      ];

      return {
        query,
        domain,
        topK,
        results: mockResults.slice(0, topK),
        executionTimeMs: Date.now() - startTime,
      };
    }

    const supabase = getSupabaseAdmin();

    // 2. 메타데이터 필터 구성
    const metadataFilter: Record<string, unknown> = {};
    if (filters.documentType && filters.documentType !== 'ALL') {
      metadataFilter.document_type = filters.documentType;
    }
    if (filters.source && filters.source.trim()) {
      metadataFilter.source = filters.source.trim();
    }

    // 3. Supabase RPC match_document_chunks 호출
    const { data: rawChunks, error: rpcErr } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: topK,
      filter_project_id: project.id,
      filter_metadata: metadataFilter,
    });

    if (rpcErr) {
      console.error('match_document_chunks RPC 호출 실패:', rpcErr);
      throw new Error(`벡터 검색 쿼리 실패: ${rpcErr.message}`);
    }

    const chunks = rawChunks || [];

    // 4. 문서 정보 조인 (문서명, 출처 등)
    const docIds = Array.from(new Set(chunks.map((c: any) => c.document_id)));
    let docMap = new Map<string, { title: string; source: string | null }>();

    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title, source')
        .in('id', docIds);

      if (docs) {
        docMap = new Map(docs.map((d) => [d.id, { title: d.title, source: d.source }]));
      }
    }

    // 결과 매핑
    const results: SearchResultItem[] = chunks.map((c: any) => {
      const doc = docMap.get(c.document_id);
      return {
        id: c.id,
        document_id: c.document_id,
        rag_project_id: c.rag_project_id,
        chunk_index: c.chunk_index,
        content: c.content,
        metadata: c.metadata || {},
        similarity: parseFloat((c.similarity || 0).toFixed(4)),
        document_title: doc?.title || '알 수 없는 문서',
        document_source: doc?.source || undefined,
      };
    });

    // 5. 검색 로그 기록 (비동기 처리)
    try {
      const { data: queryLog } = await supabase
        .from('rag_test_queries')
        .insert({
          rag_project_id: project.id,
          query,
          metadata_filter: metadataFilter,
        })
        .select('id')
        .single();

      if (queryLog && results.length > 0) {
        const resultLogs = results.map((r, rank) => ({
          test_query_id: queryLog.id,
          chunk_id: r.id,
          rank: rank + 1,
          similarity_score: r.similarity,
        }));
        await supabase.from('rag_test_results').insert(resultLogs);
      }
    } catch (logErr) {
      console.warn('검색 로그 기록 경고:', logErr);
    }

    return {
      query,
      domain,
      topK,
      results,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export const vectorSearchService = new VectorSearchService();
