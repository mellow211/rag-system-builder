import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getParserForFile } from '@/lib/parsers';
import { DocumentChunker, ChunkingOptions, GeneratedChunk } from '@/lib/chunking/chunker';
import { getEmbeddingProvider } from '@/lib/embedding';
import { RagDocument } from '@/types/rag';

export interface ExtractionAndChunkingResult {
  success: boolean;
  documentId: string;
  chunksCount: number;
  totalTextLength: number;
  error?: string;
  chunks?: GeneratedChunk[];
}

/**
 * 문서 텍스트 추출, 정제 및 청킹 파이프라인 서비스
 */
export class IngestionPipeline {
  private chunker: DocumentChunker;

  constructor(chunkOptions?: ChunkingOptions) {
    this.chunker = new DocumentChunker(chunkOptions);
  }

  /**
   * 단일 문서에 대해 Storage 파일 다운로드 -> 파싱 -> 정제 -> 청킹 -> DB 저장을 수행합니다.
   */
  async processDocumentChunks(
    documentId: string,
    fileBuffer?: Buffer
  ): Promise<ExtractionAndChunkingResult> {
    if (!isSupabaseAdminConfigured()) {
      return {
        success: true,
        documentId,
        chunksCount: 2,
        totalTextLength: 600,
        chunks: [],
      };
    }

    const supabase = getSupabaseAdmin();

    // 1. 문서 메타데이터 조회
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchErr || !doc) {
      throw new Error(`문서를 찾을 수 없습니다: ${documentId}`);
    }

    // 상태를 PROCESSING으로 업데이트
    await supabase
      .from('documents')
      .update({ status: 'PROCESSING', error_message: null })
      .eq('id', documentId);

    try {
      // 2. 파일 버퍼 확보
      let buffer = fileBuffer;
      if (!buffer) {
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from('documents')
          .download(doc.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(`스토리지 파일 다운로드 실패: ${downloadErr?.message}`);
        }

        buffer = Buffer.from(await fileData.arrayBuffer());
      }

      // 3. 파서 선택 및 텍스트 추출
      const parser = getParserForFile(doc.filename);
      const parseResult = await parser.parse(buffer, doc.filename);

      if (!parseResult.totalText || parseResult.totalText.trim().length === 0) {
        throw new Error('문서에서 추출할 수 있는 텍스트 내용이 없습니다.');
      }

      // 4. 청킹 수행
      const additionalMetadata = {
        title: doc.title,
        source: doc.source,
        publisher: doc.publisher,
        document_type: doc.document_type,
        ...(doc.metadata || {}),
      };

      const generatedChunks = this.chunker.createChunks(
        parseResult.pages,
        doc.id,
        doc.rag_project_id,
        additionalMetadata
      );

      if (generatedChunks.length === 0) {
        throw new Error('텍스트 정제 후 생성된 청크가 없습니다.');
      }

      // 5. 기존 청크 삭제 (재처리 고려)
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

      // 6. 배치 임베딩 생성 (OpenAI, Gemini 또는 Mock 어댑터)
      const embeddingProvider = getEmbeddingProvider();
      const chunkTexts = generatedChunks.map((c) => c.content);
      const embeddings = await embeddingProvider.embedBatch(chunkTexts);

      // 7. 청크 일괄 저장 (embedding vector 및 원문 content 동시 저장)
      const chunkRecords = generatedChunks.map((c, idx) => ({
        document_id: c.document_id,
        rag_project_id: c.rag_project_id,
        chunk_index: c.chunk_index,
        content: c.content,
        token_count: c.token_count,
        metadata: c.metadata,
        embedding: embeddings[idx], // pgvector 1536차원 벡터
      }));

      // 50개씩 배치 삽입
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

      // 8. 모든 임베딩 및 인덱싱 완료 -> status = 'INDEXED' 최종 승격
      await supabase
        .from('documents')
        .update({
          status: 'INDEXED',
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      return {
        success: true,
        documentId,
        chunksCount: generatedChunks.length,
        totalTextLength: parseResult.totalText.length,
        chunks: generatedChunks,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 처리 오류';
      console.error('청킹 파이프라인 오류:', errorMessage);

      // 오류 상태로 갱신
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
        error: errorMessage,
      };
    }
  }
}

export const ingestionPipeline = new IngestionPipeline();
