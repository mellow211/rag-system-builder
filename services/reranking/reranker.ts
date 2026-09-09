import { Reranker } from './types';
import { NoOpReranker } from './no-op-reranker';
import { ApiReranker } from './api-reranker';
import { RAG_CONFIG } from '@/lib/rag/config';

export * from './types';
export * from './no-op-reranker';
export * from './api-reranker';

let cachedReranker: Reranker | null = null;

export function getReranker(): Reranker {
  if (cachedReranker) return cachedReranker;

  const provider = RAG_CONFIG.rerankerProvider;

  if (RAG_CONFIG.enableReranking) {
    if (provider === 'cohere' || process.env.COHERE_API_KEY || process.env.RERANKER_API_KEY) {
      cachedReranker = new ApiReranker();
      return cachedReranker;
    }
    // 기본 스마트 Cross-Scorer Reranker
    cachedReranker = new ApiReranker();
    return cachedReranker;
  }

  cachedReranker = new NoOpReranker();
  return cachedReranker;
}
