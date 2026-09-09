import { Reranker } from './types';
import { RetrievedChunk } from '../retrieval/types';

export class NoOpReranker implements Reranker {
  readonly name = 'no-op-reranker';

  async rerank(query: string, chunks: RetrievedChunk[], topK: number): Promise<RetrievedChunk[]> {
    // 외부 API 없이 상위 topK를 그대로 반환
    return chunks.slice(0, topK).map((c, idx) => ({
      ...c,
      ranks: {
        ...c.ranks,
        final: idx + 1,
      },
    }));
  }
}
