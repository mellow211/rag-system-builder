import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getParserForFile } from '@/lib/parsers';
import { ParsedPage } from '@/lib/parsers/base';
import { DocumentChunker, GeneratedChunk, StructureChunkResult } from '@/lib/chunking/chunker';
import { getEmbeddingProvider } from '@/lib/embedding';
import { RagDocument } from '@/types/rag';

export interface ExtractionAndChunkingResult {
  success: boolean;
  documentId: string;
  chunksCount: number;
  totalTextLength: number;
  version: 'v1' | 'v2';
  parentChunksCount?: number;
  error?: string;
  chunks?: GeneratedChunk[];
  structureResult?: StructureChunkResult;
}

export interface ChunkPreviewComparison {
  documentId: string;
  documentTitle: string;
  v1: {
    chunksCount: number;
    chunks: Array<{
      chunk_index: number;
      token_count: number;
      page: number;
      content: string;
      char_length: number;
    }>;
  };
  v2: {
    chunksCount: number;
    parentChunksCount: number;
    stats: Record<string, number>;
    chunks: Array<{
      chunk_index: number;
      chunk_type: string;
      token_count: number;
      page_start: number;
      page_end: number;
      section_title: string | null;
      section_path: string[];
      parent_chunk_id?: string | null;
      content: string;
      embedding_content: string;
    }>;
  };
}

export class IngestionPipeline {
  private v1Chunker: DocumentChunker;
  private v2Chunker: DocumentChunker;

  constructor() {
    this.v1Chunker = new DocumentChunker({ version: 'v1', strategy: 'heading' });
    this.v2Chunker = new DocumentChunker({ version: 'v2' });
  }

  /**
   * 문서 원본 스토리지 또는 기존 청크에서 페이지별 텍스트를 추출/복원합니다.
   */
  private async extractDocumentPages(
    supabase: any,
    doc: any,
    fileBuffer?: Buffer
  ): Promise<ParsedPage[]> {
    let extractionError: Error | null = null;

    try {
      let buffer = fileBuffer;
      if (!buffer && doc.storage_path) {
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from('documents')
          .download(doc.storage_path);

        if (!downloadErr && fileData) {
          buffer = Buffer.from(await fileData.arrayBuffer());
        }
      }

      if (buffer) {
        const parser = getParserForFile(doc.filename);
        const parseResult = await parser.parse(buffer, doc.filename);
        if (parseResult.pages && parseResult.pages.length > 0 && parseResult.totalText.trim().length > 0) {
          return parseResult.pages;
        }
      }
    } catch (err: any) {
      extractionError = err;
    }

    // 파일에서 직접 텍스트 추출이 어렵거나 0자인 경우 (예: OCR 기처리 문서)
    // 기존에 저장된 청크 데이터에서 페이지 단위 텍스트 복원
    const { data: existingChunks } = await supabase
      .from('document_chunks')
      .select('chunk_index, content, metadata')
      .eq('document_id', doc.id)
      .order('chunk_index');

    if (existingChunks && existingChunks.length > 0) {
      const pageMap = new Map<number, string[]>();
      for (const c of existingChunks) {
        const p = (c.metadata?.page as number) || (c.metadata?.page_start as number) || 1;
        if (!pageMap.has(p)) pageMap.set(p, []);
        pageMap.get(p)!.push(c.content);
      }
      return Array.from(pageMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([pageNumber, texts]) => ({
          pageNumber,
          text: texts.join('\n\n'),
        }));
    }

    if (extractionError) {
      throw extractionError;
    }

    throw new Error(
      "이 PDF는 본문 텍스트 레이어가 없는 '스캔 이미지' 또는 '폰트 윤곽선(아웃라인) 변환' 문서입니다. 원활한 RAG 검색을 위해 Replicate AI OCR을 먼저 실행해 주세요."
    );
  }

  /**
   * 문서의 원본 파일을 파싱하여 v1(Fixed)과 v2(Structure-aware) 청킹 결과를
   * DB 변경 없이 메모리 상에서 실시간 비교할 수 있는 프리뷰 데이터를 반환합니다.
   */
  async previewComparison(documentId: string): Promise<ChunkPreviewComparison> {
    if (!isSupabaseAdminConfigured()) {
      throw new Error('Supabase가 구성되지 않았습니다.');
    }

    const supabase = getSupabaseAdmin();
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchErr || !doc) {
      throw new Error(`문서를 찾을 수 없습니다: ${documentId}`);
    }

    const pages = await this.extractDocumentPages(supabase, doc);

    const additionalMeta = {
      title: doc.title,
      source: doc.source,
      publisher: doc.publisher,
      document_type: doc.document_type,
      domain: doc.rag_project_id,
      ...(doc.metadata || {}),
    };

    // 1. v1 청킹 실행
    const v1Chunks = this.v1Chunker.createChunks(
      pages,
      doc.id,
      doc.rag_project_id,
      additionalMeta
    );

    // 2. v2 구조 분석 청킹 실행
    const v2Result = this.v2Chunker.createStructureChunks(
      pages,
      doc.id,
      doc.rag_project_id,
      additionalMeta
    );

    return {
      documentId,
      documentTitle: doc.title,
      v1: {
        chunksCount: v1Chunks.length,
        chunks: v1Chunks.map((c) => ({
          chunk_index: c.chunk_index,
          token_count: c.token_count,
          page: (c.metadata?.page as number) || 1,
          content: c.content,
          char_length: c.content.length,
        })),
      },
      v2: {
        chunksCount: v2Result.childChunks.length,
        parentChunksCount: v2Result.parentChunks.length,
        stats: v2Result.stats,
        chunks: v2Result.childChunks.map((c) => ({
          chunk_index: c.chunk_index,
          chunk_type: c.chunk_type,
          token_count: c.token_count,
          page_start: c.page_start,
          page_end: c.page_end,
          section_title: c.section_title,
          section_path: c.section_path,
          parent_chunk_id: c.parent_chunk_id,
          content: c.content,
          embedding_content: c.embedding_content,
        })),
      },
    };
  }

  /**
   * 문서에 대해 파싱 -> 구조 분석 청킹 -> Embedding Content 벡터화 -> DB 저장을 수행합니다.
   */
  async processDocumentChunks(
    documentId: string,
    fileBuffer?: Buffer,
    options?: { version?: 'v1' | 'v2' }
  ): Promise<ExtractionAndChunkingResult> {
    const version = options?.version ?? 'v2';

    if (!isSupabaseAdminConfigured()) {
      return {
        success: true,
        documentId,
        chunksCount: 2,
        totalTextLength: 600,
        version,
      };
    }

    const supabase = getSupabaseAdmin();

    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchErr || !doc) {
      throw new Error(`문서를 찾을 수 없습니다: ${documentId}`);
    }

    await supabase
      .from('documents')
      .update({ status: 'PROCESSING', error_message: null })
      .eq('id', documentId);

    try {
      const pages = await this.extractDocumentPages(supabase, doc, fileBuffer);
      const totalTextLength = pages.reduce((sum, p) => sum + p.text.length, 0);

      const additionalMetadata = {
        title: doc.title,
        source: doc.source,
        publisher: doc.publisher,
        document_type: doc.document_type,
        ...(doc.metadata || {}),
      };

      let chunkRecords: any[] = [];
      let parentChunksCount = 0;
      let finalChunksCount = 0;

      if (version === 'v2') {
        // v2 Structure-aware Chunking 실행
        const structureResult = this.v2Chunker.createStructureChunks(
          pages,
          doc.id,
          doc.rag_project_id,
          additionalMetadata
        );

        parentChunksCount = structureResult.parentChunks.length;
        finalChunksCount = structureResult.childChunks.length;

        // Embedding은 Context-enriched embedding_content를 대상으로 생성!
        const embeddingProvider = getEmbeddingProvider();
        const embeddingTexts = structureResult.childChunks.map((c) => c.embedding_content);
        const embeddings = await embeddingProvider.embedBatch(embeddingTexts);

        chunkRecords = structureResult.childChunks.map((c, idx) => ({
          document_id: c.document_id,
          rag_project_id: c.rag_project_id,
          chunk_index: c.chunk_index,
          content: c.content, // 사용자 표시용 순수 원문
          token_count: c.token_count,
          metadata: {
            ...c.metadata,
            embedding_content: c.embedding_content,
            chunk_type: c.chunk_type,
            section_title: c.section_title,
            section_path: c.section_path,
            page_start: c.page_start,
            page_end: c.page_end,
            parent_chunk_id: c.parent_chunk_id,
            chunking_version: 'v2',
          },
          embedding: embeddings[idx],
        }));
      } else {
        // v1 Fixed Chunking 실행
        const generatedChunks = this.v1Chunker.createChunks(
          pages,
          doc.id,
          doc.rag_project_id,
          additionalMetadata
        );

        finalChunksCount = generatedChunks.length;
        const embeddingProvider = getEmbeddingProvider();
        const chunkTexts = generatedChunks.map((c) => c.content);
        const embeddings = await embeddingProvider.embedBatch(chunkTexts);

        chunkRecords = generatedChunks.map((c, idx) => ({
          document_id: c.document_id,
          rag_project_id: c.rag_project_id,
          chunk_index: c.chunk_index,
          content: c.content,
          token_count: c.token_count,
          metadata: {
            ...c.metadata,
            chunking_version: 'v1',
          },
          embedding: embeddings[idx],
        }));
      }

      // 기존 청크 중 동일 버전 청크만 교체 (다른 버전의 기존 청크 데이터는 DB에 온전히 유지!)
      if (version === 'v2') {
        await supabase
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId)
          .filter('metadata->>chunking_version', 'eq', 'v2');
      } else {
        await supabase
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId)
          .or('metadata->>chunking_version.eq.v1,metadata->>chunking_version.is.null');
      }

      const batchSize = 50;
      for (let i = 0; i < chunkRecords.length; i += batchSize) {
        const batch = chunkRecords.slice(i, i + batchSize);
        const { error: insertErr } = await supabase
          .from('document_chunks')
          .insert(batch);

        if (insertErr) {
          throw new Error(`청크 DB 저장 실패: ${insertErr.message}`);
        }
      }

      // 문서 상태 승격 및 버전 메타데이터 갱신
      await supabase
        .from('documents')
        .update({
          status: 'INDEXED',
          error_message: null,
          metadata: {
            ...(doc.metadata || {}),
            chunking_version: version,
            chunks_count: finalChunksCount,
            parent_chunks_count: parentChunksCount,
            indexed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      return {
        success: true,
        documentId,
        chunksCount: finalChunksCount,
        parentChunksCount,
        totalTextLength,
        version,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 처리 오류';
      console.error('IngestionPipeline 오류:', errorMessage);

      await supabase
        .from('documents')
        .update({
          status: 'ERROR',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      return {
        success: false,
        documentId,
        chunksCount: 0,
        totalTextLength: 0,
        version,
        error: errorMessage,
      };
    }
  }
}

export const ingestionPipeline = new IngestionPipeline();
