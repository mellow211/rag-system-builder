import { RetrievedChunk } from './types';
import { RAG_CONFIG } from '@/lib/rag/config';

export interface RrfOptions {
  k?: number;
  topK?: number;
}

/**
 * Reciprocal Rank Fusion (RRF) 알고리즘
 * Vector Search 랭크와 Keyword Search 랭크를 공정하게 융합합니다.
 * RRF Score = 1 / (k + vector_rank) + 1 / (k + keyword_rank)
 */
export function reciprocalRankFusion(
  vectorChunks: RetrievedChunk[],
  keywordChunks: RetrievedChunk[],
  options?: RrfOptions
): RetrievedChunk[] {
  const k = options?.k ?? RAG_CONFIG.rrfK;
  const topK = options?.topK ?? RAG_CONFIG.hybridCandidateCount;

  // chunk.id 기준으로 후보 수집
  const chunkMap = new Map<
    string,
    {
      chunk: RetrievedChunk;
      vectorRank: number | null;
      keywordRank: number | null;
      vectorScore: number | null;
      keywordScore: number | null;
      rrfScore: number;
    }
  >();

  // 1. Vector 랭크 주입
  vectorChunks.forEach((c, idx) => {
    const rank = idx + 1;
    chunkMap.set(c.id, {
      chunk: c,
      vectorRank: rank,
      keywordRank: null,
      vectorScore: c.scores.vector ?? null,
      keywordScore: null,
      rrfScore: 1 / (k + rank),
    });
  });

  // 2. Keyword 랭크 주입 및 RRF 합산
  keywordChunks.forEach((c, idx) => {
    const rank = idx + 1;
    const existing = chunkMap.get(c.id);

    if (existing) {
      existing.keywordRank = rank;
      existing.keywordScore = c.scores.keyword ?? null;
      existing.rrfScore += 1 / (k + rank);
    } else {
      chunkMap.set(c.id, {
        chunk: c,
        vectorRank: null,
        keywordRank: rank,
        vectorScore: null,
        keywordScore: c.scores.keyword ?? null,
        rrfScore: 1 / (k + rank),
      });
    }
  });

  // 3. RRF Score 기준 내림차순 정렬
  const fusedList = Array.from(chunkMap.values());
  fusedList.sort((a, b) => b.rrfScore - a.rrfScore);

  // 4. 결과 매핑
  return fusedList.slice(0, topK).map((item, idx) => {
    const hybridRank = idx + 1;
    const rrfScoreFormatted = parseFloat(item.rrfScore.toFixed(5));

    return {
      ...item.chunk,
      similarity: rrfScoreFormatted,
      scores: {
        vector: item.vectorScore,
        keyword: item.keywordScore,
        hybrid: rrfScoreFormatted,
        rerank: null,
        final: rrfScoreFormatted,
      },
      ranks: {
        vector: item.vectorRank,
        keyword: item.keywordRank,
        hybrid: hybridRank,
        rerank: null,
        final: hybridRank,
      },
    };
  });
}
