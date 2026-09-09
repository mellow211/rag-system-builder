export interface RagConfig {
  vectorCandidateCount: number;
  lexicalCandidateCount: number;
  hybridCandidateCount: number;
  finalTopK: number;
  chunkSize: number;
  chunkOverlap: number;
  enableQueryRewrite: boolean;
  enableQueryExpansion: boolean;
  enableReranking: boolean;
  maxChunksPerDocument: number;
  rrfK: number;
  rerankerProvider: 'noop' | 'cross-encoder' | 'cohere';
}

export const RAG_CONFIG: RagConfig = {
  vectorCandidateCount: parseInt(process.env.RAG_VECTOR_CANDIDATES || '30', 10),
  lexicalCandidateCount: parseInt(process.env.RAG_LEXICAL_CANDIDATES || '30', 10),
  hybridCandidateCount: parseInt(process.env.RAG_HYBRID_CANDIDATES || '20', 10),
  finalTopK: parseInt(process.env.RAG_FINAL_TOP_K || '5', 10),
  chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '800', 10),
  chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '150', 10),
  enableQueryRewrite: process.env.ENABLE_QUERY_REWRITE !== 'false',
  enableQueryExpansion: process.env.ENABLE_QUERY_EXPANSION === 'true',
  enableReranking: process.env.ENABLE_RERANKER !== 'false',
  maxChunksPerDocument: parseInt(process.env.MAX_CHUNKS_PER_DOCUMENT || '3', 10),
  rrfK: parseInt(process.env.RRF_K || '60', 10),
  rerankerProvider: (process.env.RERANKER_PROVIDER as any) || 'noop',
};
