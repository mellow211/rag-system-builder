import { Reranker } from './types';
import { RetrievedChunk } from '../retrieval/types';

export class ApiReranker implements Reranker {
  readonly name = 'api-reranker';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.RERANKER_API_KEY || process.env.COHERE_API_KEY || '';
    this.model = model || process.env.RERANKER_MODEL || 'rerank-v3.5';
  }

  async rerank(query: string, chunks: RetrievedChunk[], topK: number): Promise<RetrievedChunk[]> {
    if (chunks.length === 0) return [];

    // 1. Cohere Rerank API 연동 시도
    if (this.apiKey) {
      try {
        const documents = chunks.map((c) => ({ text: c.content }));
        const res = await fetch('https://api.cohere.com/v2/rerank', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            query,
            documents,
            top_n: topK,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const reranked: RetrievedChunk[] = [];

          if (Array.isArray(data.results)) {
            data.results.forEach((item: any, rankIdx: number) => {
              const originalChunk = chunks[item.index];
              if (originalChunk) {
                const rerankScore = parseFloat((item.relevance_score || 0).toFixed(4));
                reranked.push({
                  ...originalChunk,
                  similarity: rerankScore,
                  scores: {
                    ...originalChunk.scores,
                    rerank: rerankScore,
                    final: rerankScore,
                  },
                  ranks: {
                    ...originalChunk.ranks,
                    rerank: rankIdx + 1,
                    final: rankIdx + 1,
                  },
                });
              }
            });
            return reranked;
          }
        }
      } catch (err) {
        console.warn('Cohere Rerank API 호출 실패, Local Cross-Scorer fallback:', err);
      }
    }

    // 2. Local Cross-Scoring fallback:
    // 질의문의 핵심 단어와 청크 본문/섹션 제목의 일치율을 바탕으로 재정렬
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
    const scoredChunks = chunks.map((chunk) => {
      const lowerContent = chunk.content.toLowerCase();
      const lowerSection = (chunk.section_title || '').toLowerCase();

      let termMatches = 0;
      for (const t of queryTerms) {
        if (lowerContent.includes(t)) termMatches += 1;
        if (lowerSection.includes(t)) termMatches += 1.5; // 섹션 제목 매칭 가중치
      }

      const matchRatio = termMatches / Math.max(1, queryTerms.length * 1.5);
      // 기존 Hybrid 점수 60% + Cross-Term 정밀도 40%
      const prevScore = chunk.scores.hybrid ?? chunk.similarity;
      const rerankScore = parseFloat((prevScore * 0.6 + matchRatio * 0.4).toFixed(4));

      return {
        chunk,
        score: rerankScore,
      };
    });

    scoredChunks.sort((a, b) => b.score - a.score);

    return scoredChunks.slice(0, topK).map((item, idx) => {
      const finalRank = idx + 1;
      return {
        ...item.chunk,
        similarity: item.score,
        scores: {
          ...item.chunk.scores,
          rerank: item.score,
          final: item.score,
        },
        ranks: {
          ...item.chunk.ranks,
          rerank: finalRank,
          final: finalRank,
        },
      };
    });
  }
}
