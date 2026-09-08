import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getProjectByDomain } from '@/lib/supabase/projects';
import { DomainType, SearchResultItem } from '@/types/rag';
import { VectorSearchParams, VectorSearchResult } from './vector-search';

/**
 * PostgreSQL Full-Text Search (FTS) 기반 키워드 검색 서비스 (하이브리드 확장용)
 */
export class KeywordSearchService {
  async search(params: VectorSearchParams): Promise<VectorSearchResult> {
    const startTime = Date.now();
    const { domain, query, topK = 5 } = params;

    if (!isSupabaseAdminConfigured()) {
      return {
        query,
        domain,
        topK,
        results: [],
        executionTimeMs: Date.now() - startTime,
      };
    }

    const supabase = getSupabaseAdmin();
    const project = await getProjectByDomain(domain);
    if (!project) {
      return {
        query,
        domain,
        topK,
        results: [],
        executionTimeMs: Date.now() - startTime,
      };
    }

    // PostgreSQL FTS textSearch 쿼리
    const { data: chunks, error } = await supabase
      .from('document_chunks')
      .select('id, document_id, rag_project_id, chunk_index, content, metadata')
      .eq('rag_project_id', project.id)
      .textSearch('content', query, {
        type: 'websearch',
        config: 'simple',
      })
      .limit(topK);

    if (error || !chunks) {
      console.warn('키워드 검색 실행 경고:', error?.message);
      return {
        query,
        domain,
        topK,
        results: [],
        executionTimeMs: Date.now() - startTime,
      };
    }

    const results: SearchResultItem[] = chunks.map((c: any, rank: number) => ({
      id: c.id,
      document_id: c.document_id,
      rag_project_id: c.rag_project_id,
      chunk_index: c.chunk_index,
      content: c.content,
      metadata: c.metadata || {},
      similarity: parseFloat((1 / (rank + 1)).toFixed(4)), // 순위 기반 임시 스코어
    }));

    return {
      query,
      domain,
      topK,
      results,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export const keywordSearchService = new KeywordSearchService();
