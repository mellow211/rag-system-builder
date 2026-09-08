import { VectorSearchParams, VectorSearchResult, vectorSearchService } from './vector-search';
import { keywordSearchService } from './keyword-search';
import { SearchResultItem } from '@/types/rag';

/**
 * Vector Search + Keyword Search + Metadata Filter 하이브리드 검색 서비스 스켈레톤
 * Reciprocal Rank Fusion (RRF) 방식을 채택할 수 있는 아키텍처 구조를 갖추고 있습니다.
 */
export class HybridSearchService {
  async search(params: VectorSearchParams): Promise<VectorSearchResult> {
    const startTime = Date.now();

    // 1. 벡터 검색 수행
    const vectorResult = await vectorSearchService.search(params);

    // 2. 키워드 검색 수행 (현재는 스켈레톤으로 병렬 호출 가능 구조)
    // const keywordResult = await keywordSearchService.search(params);

    // 3. RRF (Reciprocal Rank Fusion) 결합 로직 자리 (추후 Phase에서 확장)
    // 현재 MVP에서는 검증 완료된 Vector Search 결과를 기본 반환합니다.
    return {
      ...vectorResult,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export const hybridSearchService = new HybridSearchService();
