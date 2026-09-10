import { IngestionChunk } from '../chunking/types';

export interface DocumentContext {
  documentId: string;
  documentTitle: string;
  domain: string;
  documentSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface ContextualizedChunkResult {
  chunkIndex: number;
  contextText: string;            // LLM이 생성한 1~3문장의 짧은 문맥 설명 (30~100 tokens)
  contextModel: string;           // 'gpt-4o-mini', 'claude-3-haiku', 'deterministic-v2' 등
  promptVersion: string;          // 'ctx-prompt-v1'
  generatedAt: string;
  fromCache: boolean;
  contextualizedContent: string;  // 문맥 + 원문 결합 (디버깅용)
  embeddingContent: string;       // Vector DB에 임베딩할 최종 텍스트
}

export interface Contextualizer {
  readonly providerName: string;
  contextualize(chunk: IngestionChunk, docContext: DocumentContext): Promise<ContextualizedChunkResult>;
  contextualizeBatch(chunks: IngestionChunk[], docContext: DocumentContext): Promise<ContextualizedChunkResult[]>;
}
