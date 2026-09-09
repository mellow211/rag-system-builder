import { normalizeQuery } from './normalize-query';
import { RAG_CONFIG } from '@/lib/rag/config';

export interface QueryExpansionResult {
  originalQuery: string;
  expandedQueries: string[];
}

/**
 * 다각적 검색 매칭을 위해 질의문을 최대 3개의 확장 검색어로 생성합니다.
 */
export async function expandQuery(
  rawQuery: string,
  options?: { maxQueries?: number; enableExpansion?: boolean }
): Promise<QueryExpansionResult> {
  const normalized = normalizeQuery(rawQuery);
  const enable = options?.enableExpansion ?? RAG_CONFIG.enableQueryExpansion;
  const maxQueries = options?.maxQueries ?? 3;

  if (!enable || !normalized) {
    return {
      originalQuery: rawQuery,
      expandedQueries: [normalized || rawQuery],
    };
  }

  const queries = new Set<string>();
  queries.add(normalized);

  // 기본 확장 패턴 생성 (키워드 추출형 및 축약형)
  const tokens = normalized.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length >= 2) {
    queries.add(tokens.join(' '));
    queries.add(tokens.slice(0, 3).join(' '));
  }

  return {
    originalQuery: rawQuery,
    expandedQueries: Array.from(queries).slice(0, maxQueries),
  };
}
