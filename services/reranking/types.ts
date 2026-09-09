import { RetrievedChunk } from '../retrieval/types';

export interface Reranker {
  readonly name: string;
  rerank(query: string, chunks: RetrievedChunk[], topK: number): Promise<RetrievedChunk[]>;
}
