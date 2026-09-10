import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getParserForFile } from '@/lib/parsers';
import { ParsedPage } from '@/lib/parsers/base';
import { DocumentChunker, GeneratedChunk } from '@/lib/chunking/chunker';
import { getEmbeddingProvider } from '@/lib/embedding';
import { cleanDocument } from './cleaning/clean-document';
import { ParentChildChunker } from './chunking/parent-child-chunker';
import { getContextualizer, DocumentContext } from './contextualization/contextualizer';
import { EmbeddingContentBuilder } from './embedding/embedding-content-builder';

export interface ExtractionAndChunkingResult {
  success: boolean;
  documentId: string;
  chunksCount: number;
  totalTextLength: number;
  version: 'v1' | 'v2';
  parentChunksCount?: number;
  error?: string;
  chunks?: GeneratedChunk[];
  cleaningStats?: {
    removedChars: number;
    medicalTermsIntact: boolean;
  };
}

export interface ChunkPreviewComparison {
  documentId: string;
  documentTitle: string;
  v1: {
    chunksCount: number;
    avgTokens: number;
    midSentenceCuts: number;
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
    avgTokens: number;
    minTokens: number;
    maxTokens: number;
    midSentenceCuts: number;
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
      context_text?: string;
      contextualized_content?: string;
      embedding_content: string;
    }>;
  };
}

export class IngestionPipeline {
  private v1Chunker: DocumentChunker;
  private v2ParentChildChunker: ParentChildChunker;

  constructor() {
    this.v1Chunker = new DocumentChunker({ version: 'v1', strategy: 'heading' });
    this.v2ParentChildChunker = new ParentChildChunker({
      targetTokens: 500,
      maxTokens: 750,
      minTokens: 150,
      overlapTokens: 50,
      hardMaxTokens: 1000,
    });
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
   * 문서 원본을 파싱하여 v1(Fixed)과 v2(Structure-aware + LLM Context) 청킹 결과를
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

    const rawPages = await this.extractDocumentPages(supabase, doc);

    // 1. Text Cleaning 적용
    const cleanedPages = rawPages.map((p) => ({
      pageNumber: p.pageNumber,
      text: cleanDocument(p.text).cleanedText,
    }));

    const additionalMeta = {
      title: doc.title,
      source: doc.source,
      publisher: doc.publisher,
      document_type: doc.document_type,
      domain: doc.rag_project_id,
      ...(doc.metadata || {}),
    };

    // 2. v1 고정길이 청킹 실행 및 통계 산출
    const v1Chunks = this.v1Chunker.createChunks(
      rawPages,
      doc.id,
      doc.rag_project_id,
      additionalMeta
    );

    let v1MidSentenceCuts = 0;
    let v1TotalTokens = 0;
    for (const c of v1Chunks) {
      const tok = c.token_count || Math.ceil(c.content.length / 1.7);
      v1TotalTokens += tok;
      if (!/[.!?]$/.test(c.content.trim())) {
        v1MidSentenceCuts++;
      }
    }
    const v1AvgTokens = v1Chunks.length > 0 ? Math.round(v1TotalTokens / v1Chunks.length) : 0;

    // 3. v2 구조 분석 청킹 실행
    const v2Result = this.v2ParentChildChunker.process(
      cleanedPages,
      doc.id,
      doc.rag_project_id,
      additionalMeta
    );

    // 4. LLM Contextualization 적용
    const docContext: DocumentContext = {
      documentId: doc.id,
      documentTitle: doc.title,
      domain: (doc.metadata?.domain as string) || doc.rag_project_id,
    };

    const contextualizer = getContextualizer();
    const ctxResults = await contextualizer.contextualizeBatch(v2Result.childChunks, docContext);

    // Context 결과를 각 Child 청크에 매핑
    const enrichedChildChunks = v2Result.childChunks.map((chunk, idx) => {
      const ctx = ctxResults[idx];
      const contextText = ctx?.contextText;
      const embeddingContent = EmbeddingContentBuilder.build({
        documentTitle: doc.title,
        domain: docContext.domain,
        sectionPath: chunk.section_path,
        contextText,
        content: chunk.content,
      });

      return {
        chunk_index: chunk.chunk_index,
        chunk_type: chunk.chunk_type,
        token_count: chunk.token_count,
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        section_title: chunk.section_title,
        section_path: chunk.section_path,
        parent_chunk_id: chunk.parent_chunk_id,
        content: chunk.content,
        context_text: contextText,
        contextualized_content: ctx?.contextualizedContent,
        embedding_content: embeddingContent,
      };
    });

    return {
      documentId,
      documentTitle: doc.title,
      v1: {
        chunksCount: v1Chunks.length,
        avgTokens: v1AvgTokens,
        midSentenceCuts: v1MidSentenceCuts,
        chunks: v1Chunks.map((c) => ({
          chunk_index: c.chunk_index,
          token_count: c.token_count || Math.ceil(c.content.length / 1.7),
          page: (c.metadata?.page as number) || 1,
          content: c.content,
          char_length: c.content.length,
        })),
      },
      v2: {
        chunksCount: enrichedChildChunks.length,
        parentChunksCount: v2Result.parentChunks.length,
        avgTokens: v2Result.stats.avgTokensPerChunk,
        minTokens: v2Result.stats.minTokens,
        maxTokens: v2Result.stats.maxTokens,
        midSentenceCuts: v2Result.stats.midSentenceCutCount,
        stats: v2Result.stats,
        chunks: enrichedChildChunks,
      },
    };
  }

  /**
   * 문서에 대해 Text Extraction ➡️ Cleaning ➡️ Structure Parsing ➡️ Chunking ➡️ LLM Context ➡️ Embedding ➡️ DB 저장 실행
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
      const rawPages = await this.extractDocumentPages(supabase, doc, fileBuffer);

      // 1. Text Cleaning 수행
      let totalCleanedCharsRemoved = 0;
      let allMedicalTermsIntact = true;

      const cleanedPages = rawPages.map((p) => {
        const cleanRes = cleanDocument(p.text);
        totalCleanedCharsRemoved += cleanRes.stats.removedChars;
        if (!cleanRes.stats.medicalTermsIntact) allMedicalTermsIntact = false;
        return {
          pageNumber: p.pageNumber,
          text: cleanRes.cleanedText,
        };
      });

      const totalTextLength = cleanedPages.reduce((sum, p) => sum + p.text.length, 0);

      const additionalMetadata = {
        title: doc.title,
        source: doc.source,
        publisher: doc.publisher,
        document_type: doc.document_type,
        domain: doc.rag_project_id,
        ...(doc.metadata || {}),
      };

      let chunkRecords: any[] = [];
      let parentChunksCount = 0;
      let finalChunksCount = 0;

      if (version === 'v2') {
        // 2. Structure-aware Parent/Child Chunking
        const chunkingResult = this.v2ParentChildChunker.process(
          cleanedPages,
          doc.id,
          doc.rag_project_id,
          additionalMetadata
        );

        parentChunksCount = chunkingResult.parentChunks.length;
        finalChunksCount = chunkingResult.childChunks.length;

        // 3. LLM Contextualization 실행 (실패 시 안전 폴백)
        const docContext: DocumentContext = {
          documentId: doc.id,
          documentTitle: doc.title,
          domain: (doc.metadata?.domain as string) || doc.rag_project_id,
        };

        const contextualizer = getContextualizer();
        const ctxResults = await contextualizer.contextualizeBatch(chunkingResult.childChunks, docContext);

        // 4. Embedding Content 조합
        const embeddingTexts: string[] = [];
        const enrichedChunks = chunkingResult.childChunks.map((c, idx) => {
          const ctx = ctxResults[idx];
          const contextText = ctx?.contextText;
          const embeddingContent = EmbeddingContentBuilder.build({
            documentTitle: doc.title,
            domain: docContext.domain,
            sectionPath: c.section_path,
            contextText,
            content: c.content,
          });

          embeddingTexts.push(embeddingContent);

          return {
            ...c,
            context_text: contextText,
            contextualized_content: ctx?.contextualizedContent,
            embedding_content: embeddingContent,
          };
        });

        // 5. pgvector 임베딩 생성 (embedding_content 대상!)
        const embeddingProvider = getEmbeddingProvider();
        const embeddings = await embeddingProvider.embedBatch(embeddingTexts);

        // 6. DB 저장용 레코드 구성 (content는 순수 원문 유지, embedding_content 및 context는 metadata 저장)
        chunkRecords = enrichedChunks.map((c, idx) => ({
          document_id: c.document_id,
          rag_project_id: c.rag_project_id,
          chunk_index: c.chunk_index,
          content: c.content, // 사용자 화면/인용용 순수 원문
          token_count: c.token_count,
          metadata: {
            ...c.metadata,
            context_text: c.context_text,
            contextualized_content: c.contextualized_content,
            embedding_content: c.embedding_content,
            chunk_type: c.chunk_type,
            section_title: c.section_title,
            section_path: c.section_path,
            page_start: c.page_start,
            page_end: c.page_end,
            parent_chunk_id: c.parent_chunk_id,
            chunking_version: 'v2',
            context_model: ctxResults[idx]?.contextModel,
            context_prompt_version: ctxResults[idx]?.promptVersion,
          },
          embedding: embeddings[idx],
        }));
      } else {
        // v1 Fixed Chunking 실행
        const generatedChunks = this.v1Chunker.createChunks(
          rawPages,
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

      // 7. 기존 청크 중 동일 버전 청크만 교체 (타 버전 청크는 DB에 보존!)
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

      // 8. 일괄 저장 (Batch 50)
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

      // 9. 문서 상태 승격 및 버전 메타데이터 갱신
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
            cleaned_chars_removed: totalCleanedCharsRemoved,
            medical_terms_intact: allMedicalTermsIntact,
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
        cleaningStats: {
          removedChars: totalCleanedCharsRemoved,
          medicalTermsIntact: allMedicalTermsIntact,
        },
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
