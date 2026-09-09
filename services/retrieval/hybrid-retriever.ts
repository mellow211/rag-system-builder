import { vectorRetriever } from './vector-retriever';
import { lexicalRetriever } from './lexical-retriever';
import { reciprocalRankFusion } from './rrf';
import { RetrievalOptions, RetrievedChunk } from './types';
import { RAG_CONFIG } from '@/lib/rag/config';

export interface HybridSearchResult {
  query: string;
  vectorChunks: RetrievedChunk[];
  keywordChunks: RetrievedChunk[];
  fusedChunks: RetrievedChunk[];
  latencies: {
    vectorMs: number;
    keywordMs: number;
    fusionMs: number;
  };
}

export class HybridRetriever {
  readonly name = 'hybrid-retriever';

  async search(query: string, options: RetrievalOptions): Promise<HybridSearchResult> {
    const candidateCount = options.topK ?? RAG_CONFIG.vectorCandidateCount;

    const tVectorStart = Date.now();
    const vectorPromise = vectorRetriever
      .search(query, { ...options, topK: candidateCount })
      .catch((err) => {
        console.warn('HybridRetriever vector error:', err);
        return [] as RetrievedChunk[];
      });

    const tKeywordStart = Date.now();
    const keywordPromise = lexicalRetriever
      .search(query, { ...options, topK: candidateCount })
      .catch((err) => {
        console.warn('HybridRetriever keyword error:', err);
        return [] as RetrievedChunk[];
      });

    // 병렬 호출
    const [vectorChunks, keywordChunks] = await Promise.all([vectorPromise, keywordPromise]);

    const vectorMs = Date.now() - tVectorStart;
    const keywordMs = Date.now() - tKeywordStart;

    // RRF 퓨전
    const tFusionStart = Date.now();
    const fusedChunks = reciprocalRankFusion(vectorChunks, keywordChunks, {
      k: RAG_CONFIG.rrfK,
      topK: options.topK ?? RAG_CONFIG.hybridCandidateCount,
    });
    const fusionMs = Date.now() - tFusionStart;

    return {
      query,
      vectorChunks,
      keywordChunks,
      fusedChunks,
      latencies: {
        vectorMs,
        keywordMs,
        fusionMs,
      },
    };
  }
}

export const hybridRetriever = new HybridRetriever();
