import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getEmbeddingProvider } from '@/lib/embedding';
import { getProjectByDomain } from '@/lib/supabase/projects';
import { Retriever, RetrievalOptions, RetrievedChunk } from './types';
import { DomainType } from '@/types/rag';
import { RAG_CONFIG } from '@/lib/rag/config';

export class PostgresVectorRetriever implements Retriever {
  readonly name = 'postgres-vector-retriever';

  async search(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]> {
    if (!query || query.trim().length === 0) return [];
    if (!isSupabaseAdminConfigured()) return [];

    const candidateCount = options.topK ?? RAG_CONFIG.vectorCandidateCount;
    const threshold = options.threshold ?? -1.0;
    const filters = options.filters ?? {};

    // 1. 임베딩 생성
    const embeddingProvider = getEmbeddingProvider();
    const queryEmbedding = await embeddingProvider.embedText(query.trim());

    const supabase = getSupabaseAdmin();

    // 2. 도메인 필터 매핑
    let projectIds: string[] | null = null;
    const targetDomains: DomainType[] = options.domains && options.domains.length > 0
      ? options.domains
      : options.domain
      ? [options.domain]
      : [];

    if (targetDomains.length > 0) {
      const projects = await Promise.all(targetDomains.map((d) => getProjectByDomain(d)));
      projectIds = projects.filter(Boolean).map((p) => p!.id);
    }

    const metadataFilter: Record<string, unknown> = {};
    if (filters.documentType && filters.documentType !== 'ALL') {
      metadataFilter.document_type = filters.documentType;
    }
    if (filters.source && filters.source.trim()) {
      metadataFilter.source = filters.source.trim();
    }

    // 3. Supabase RPC 호출
    // 다중 도메인이면 첫 번째 project_id 전달하거나 null (전체)
    const filterProjectId = projectIds && projectIds.length === 1 ? projectIds[0] : null;

    const { data: rawChunks, error: rpcErr } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: candidateCount,
      filter_project_id: filterProjectId,
      filter_metadata: metadataFilter,
    });

    if (rpcErr || !rawChunks) {
      console.error('VectorRetriever RPC error:', rpcErr);
      return [];
    }

    let chunks = rawChunks;
    // 만약 다중 도메인 필터가 2개 이상 선택된 경우 메모리 필터링
    if (projectIds && projectIds.length > 1) {
      chunks = chunks.filter((c: any) => projectIds!.includes(c.rag_project_id));
    }

    // 4. 문서 정보 조인
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

    // 5. RetrievedChunk 표준 매핑
    return chunks.map((c: any, index: number) => {
      const doc = docMap.get(c.document_id);
      const score = parseFloat((c.similarity || 0).toFixed(4));
      const sectionTitle = (c.metadata?.section_title || c.metadata?.section || null) as string | null;

      return {
        id: c.id,
        document_id: c.document_id,
        rag_project_id: c.rag_project_id,
        chunk_index: c.chunk_index,
        content: c.content,
        document_title: doc?.title || '문서명 없음',
        document_source: doc?.source || undefined,
        domain: options.domain || targetDomains[0],
        section_title: sectionTitle,
        metadata: c.metadata || {},
        similarity: score,
        scores: {
          vector: score,
          keyword: null,
          hybrid: null,
          rerank: null,
          final: score,
        },
        ranks: {
          vector: index + 1,
          keyword: null,
          hybrid: null,
          rerank: null,
          final: index + 1,
        },
      };
    });
  }
}

export const vectorRetriever = new PostgresVectorRetriever();
