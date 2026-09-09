import { ParsedPage } from '../parsers/base';
import { ChunkingOptions, ChunkStrategy, GeneratedChunk } from './types';
import { HeadingAwareChunkStrategy } from './heading-chunker';
import { RecursiveChunkStrategy } from './recursive-chunker';
import { RAG_CONFIG } from '../rag/config';

export * from './types';
export * from './heading-chunker';
export * from './recursive-chunker';

export class DocumentChunker {
  private chunkSize: number;
  private chunkOverlap: number;
  private strategy: ChunkStrategy;

  constructor(options?: ChunkingOptions) {
    this.chunkSize = options?.chunkSize ?? RAG_CONFIG.chunkSize;
    this.chunkOverlap = options?.chunkOverlap ?? RAG_CONFIG.chunkOverlap;

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('chunkOverlap은 chunkSize보다 작아야 합니다.');
    }

    if (options?.strategy === 'recursive') {
      this.strategy = new RecursiveChunkStrategy();
    } else {
      // 기본값: HeadingAware + Recursive 하이브리드 전략
      this.strategy = new HeadingAwareChunkStrategy();
    }
  }

  /**
   * 페이지 목록을 수신하여 Heading 및 구조가 보존된 청크 목록을 생성합니다.
   */
  public createChunks(
    pages: ParsedPage[],
    documentId: string,
    ragProjectId: string,
    additionalMetadata: Record<string, unknown> = {}
  ): GeneratedChunk[] {
    return this.strategy.chunk({
      pages,
      documentId,
      ragProjectId,
      additionalMetadata,
      options: {
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
      },
    });
  }
}
