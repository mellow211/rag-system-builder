import { ParsedPage } from '../parsers/base';
import { ChunkingOptions, ChunkStrategy, GeneratedChunk } from './types';
import { HeadingAwareChunkStrategy } from './heading-chunker';
import { RecursiveChunkStrategy } from './recursive-chunker';
import { StructureChunker } from './structure/structure-chunker';
import { StructureChunkResult, StructureGeneratedChunk } from './structure/types';
import { RAG_CONFIG } from '../rag/config';

export * from './types';
export * from './heading-chunker';
export * from './recursive-chunker';
export * from './structure/types';
export * from './structure/structure-chunker';
export * from './structure/block-parser';
export * from './structure/sentence-splitter';
export * from './token-counter';

export interface ExtendedChunkingOptions extends ChunkingOptions {
  version?: 'v1' | 'v2';
  targetTokens?: number;
  maxTokens?: number;
  minTokens?: number;
}

export class DocumentChunker {
  private version: 'v1' | 'v2';
  private v1Strategy: ChunkStrategy;
  private v2StructureChunker: StructureChunker;

  constructor(options?: ExtendedChunkingOptions) {
    this.version = options?.version ?? 'v2';

    if (options?.strategy === 'recursive') {
      this.v1Strategy = new RecursiveChunkStrategy();
    } else {
      this.v1Strategy = new HeadingAwareChunkStrategy();
    }

    this.v2StructureChunker = new StructureChunker({
      targetTokens: options?.targetTokens ?? 550,
      maxTokens: options?.maxTokens ?? 800,
      minTokens: options?.minTokens ?? 150,
      overlapRatio: 0.1,
    });
  }

  /**
   * v2 구조 분석 청킹 실행 (Parent / Child 청크 분리 및 Context 메타데이터 추가)
   */
  public createStructureChunks(
    pages: ParsedPage[],
    documentId: string,
    ragProjectId: string,
    additionalMetadata: Record<string, unknown> = {}
  ): StructureChunkResult {
    return this.v2StructureChunker.chunkDocument(
      pages,
      documentId,
      ragProjectId,
      additionalMetadata
    );
  }

  /**
   * 하위 호환 createChunks 메서드 (version에 따라 v1 또는 v2 반환)
   */
  public createChunks(
    pages: ParsedPage[],
    documentId: string,
    ragProjectId: string,
    additionalMetadata: Record<string, unknown> = {}
  ): GeneratedChunk[] {
    if (this.version === 'v2') {
      const result = this.createStructureChunks(pages, documentId, ragProjectId, additionalMetadata);
      // v2 child chunks를 GeneratedChunk 호환 형태로 매핑
      return result.childChunks.map((c) => ({
        document_id: c.document_id,
        rag_project_id: c.rag_project_id,
        chunk_index: c.chunk_index,
        content: c.content,
        token_count: c.token_count,
        section_title: c.section_title,
        parent_chunk_id: c.parent_chunk_id,
        metadata: {
          ...c.metadata,
          chunking_version: 'v2',
        },
      }));
    }

    return this.v1Strategy.chunk({
      pages,
      documentId,
      ragProjectId,
      additionalMetadata,
      options: {
        chunkSize: RAG_CONFIG.chunkSize,
        chunkOverlap: RAG_CONFIG.chunkOverlap,
      },
    });
  }
}
