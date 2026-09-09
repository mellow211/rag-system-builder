import { normalizeQuery } from '../query/normalize-query';
import { rewriteQuery } from '../query/rewrite-query';
import { hybridRetriever } from './hybrid-retriever';
import { vectorRetriever } from './vector-retriever';
import { lexicalRetriever } from './lexical-retriever';
import { applyDiversityFilter } from './diversity';
import { getReranker } from '../reranking/reranker';
import { RetrievalOptions, RetrievedChunk, SearchFilters } from './types';
import { DomainType, SearchLatencyBreakdown } from '@/types/rag';
import { RAG_CONFIG } from '@/lib/rag/config';

export type SearchPipelineMode = 'vector-only' | 'keyword-only' | 'hybrid' | 'advanced-v2';

export interface AdvancedSearchParams {
  domain?: DomainType;
  domains?: DomainType[];
  query: string;
  topK?: number;
  mode?: SearchPipelineMode;
  filters?: SearchFilters;
  options?: {
    queryRewrite?: boolean;
    queryExpansion?: boolean;
    rerank?: boolean;
    debug?: boolean;
  };
}

export interface AdvancedSearchResult {
  query: {
    original: string;
    normalized: string;
    rewritten: string;
    isRewritten: boolean;
  };
  domain?: DomainType;
  domains?: DomainType[];
  topK: number;
  mode: SearchPipelineMode;
  results: RetrievedChunk[];
  executionTimeMs: number;
  latencyBreakdown: SearchLatencyBreakdown;
  debugInfo: Record<string, unknown>;
}

export class AdvancedSearchService {
  async search(params: AdvancedSearchParams): Promise<AdvancedSearchResult> {
    const totalStart = Date.now();
    const {
      domain,
      domains,
      query: rawQuery,
      topK = RAG_CONFIG.finalTopK,
      mode = 'advanced-v2',
      filters = {},
      options = {},
    } = params;

    if (!rawQuery || rawQuery.trim().length === 0) {
      throw new Error('검색 질문을 입력해 주세요.');
    }

    // 1. Query Normalization & Rewrite (소요시간 측정)
    const tRewriteStart = Date.now();
    const normalized = normalizeQuery(rawQuery);
    const rewriteResult = await rewriteQuery(normalized, {
      enableRewrite: options.queryRewrite ?? RAG_CONFIG.enableQueryRewrite,
    });
    const queryRewriteMs = Date.now() - tRewriteStart;

    // 최종 검색에 사용할 질의문
    const effectiveQuery = rewriteResult.rewrittenQuery || normalized;

    const retrievalOptions: RetrievalOptions = {
      domain,
      domains,
      topK: mode === 'advanced-v2' ? RAG_CONFIG.vectorCandidateCount : topK,
      filters,
      debug: options.debug,
    };

    let vectorSearchMs = 0;
    let keywordSearchMs = 0;
    let fusionMs = 0;
    let rerankMs = 0;
    let finalCandidates: RetrievedChunk[] = [];

    // 2. 모드별 검색 실행
    if (mode === 'vector-only') {
      const tVecStart = Date.now();
      finalCandidates = await vectorRetriever.search(effectiveQuery, { ...retrievalOptions, topK });
      vectorSearchMs = Date.now() - tVecStart;
    } else if (mode === 'keyword-only') {
      const tKeyStart = Date.now();
      finalCandidates = await lexicalRetriever.search(effectiveQuery, { ...retrievalOptions, topK });
      keywordSearchMs = Date.now() - tKeyStart;
    } else if (mode === 'hybrid') {
      const hybridResult = await hybridRetriever.search(effectiveQuery, {
        ...retrievalOptions,
        topK,
      });
      finalCandidates = hybridResult.fusedChunks;
      vectorSearchMs = hybridResult.latencies.vectorMs;
      keywordSearchMs = hybridResult.latencies.keywordMs;
      fusionMs = hybridResult.latencies.fusionMs;
    } else {
      // 3. [ADVANCED-V2]: Vector + Keyword (Top 30) -> RRF (Top 20) -> Diversity -> Rerank (Top 5)
      const hybridResult = await hybridRetriever.search(effectiveQuery, {
        ...retrievalOptions,
        topK: RAG_CONFIG.vectorCandidateCount,
      });

      vectorSearchMs = hybridResult.latencies.vectorMs;
      keywordSearchMs = hybridResult.latencies.keywordMs;
      fusionMs = hybridResult.latencies.fusionMs;

      // 다양성 및 인접 청크 중복 방지 필터 (Top 20 내에서 동일 문서 최대 3개)
      const diversifiedCandidates = applyDiversityFilter(hybridResult.fusedChunks, {
        maxChunksPerDocument: RAG_CONFIG.maxChunksPerDocument,
        preventAdjacentChunks: true,
      });

      // Reranker 실행 (최종 Top K 선정)
      const tRerankStart = Date.now();
      const shouldRerank = options.rerank ?? RAG_CONFIG.enableReranking;
      if (shouldRerank) {
        const reranker = getReranker();
        finalCandidates = await reranker.rerank(effectiveQuery, diversifiedCandidates, topK);
      } else {
        finalCandidates = diversifiedCandidates.slice(0, topK);
      }
      rerankMs = Date.now() - tRerankStart;
    }

    const totalMs = Date.now() - totalStart;

    return {
      query: {
        original: rawQuery,
        normalized,
        rewritten: rewriteResult.rewrittenQuery,
        isRewritten: rewriteResult.isRewritten,
      },
      domain,
      domains,
      topK,
      mode,
      results: finalCandidates,
      executionTimeMs: totalMs,
      latencyBreakdown: {
        queryRewriteMs,
        vectorSearchMs,
        keywordSearchMs,
        fusionMs,
        rerankMs,
        totalMs,
      },
      debugInfo: {
        mode,
        isRewritten: rewriteResult.isRewritten,
        rewriteReason: rewriteResult.rewriteReason,
        candidateCount: finalCandidates.length,
        maxChunksPerDoc: RAG_CONFIG.maxChunksPerDocument,
        rrfK: RAG_CONFIG.rrfK,
      },
    };
  }
}

export const advancedSearchService = new AdvancedSearchService();
