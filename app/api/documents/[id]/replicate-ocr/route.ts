import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { runReplicateMarkerOcr } from '@/lib/ocr/replicate-ocr';
import { DocumentChunker } from '@/lib/chunking/chunker';
import { getEmbeddingProvider } from '@/lib/embedding';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        documentId: id,
        chunksCount: 25,
        totalChars: 12500,
        mock: true,
      });
    }

    const supabase = getSupabaseAdmin();

    // 1. 문서 메타데이터 조회
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: `문서를 찾을 수 없습니다: ${id}` }, { status: 404 });
    }

    if (!doc.storage_path) {
      return NextResponse.json({ error: '문서의 스토리지 파일 경로가 존재하지 않습니다.' }, { status: 400 });
    }

    // 상태를 PROCESSING으로 변경
    await supabase
      .from('documents')
      .update({ status: 'PROCESSING', error_message: null })
      .eq('id', id);

    // 2. Supabase Storage Signed URL 생성 (Replicate 클라우드 접근용)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 3600);

    if (signedErr || !signedData?.signedUrl) {
      throw new Error(`스토리지 다운로드 URL 발급 실패: ${signedErr?.message}`);
    }

    // 3. Replicate datalab-to/marker OCR 실행
    const ocrResult = await runReplicateMarkerOcr(signedData.signedUrl, {
      mode: 'balanced',
      forceOcr: true,
    });

    // 4. 추출된 구조화 Markdown 기반 단락/문장 청킹 수행
    const chunker = new DocumentChunker({ chunkSize: 800, chunkOverlap: 150 });
    const additionalMetadata = {
      title: doc.title,
      source: doc.source,
      publisher: doc.publisher,
      document_type: doc.document_type,
      ocr_processed: true,
      ocr_provider: 'replicate-marker',
      ...(doc.metadata || {}),
    };

    const generatedChunks = chunker.createChunks(
      ocrResult.pages,
      doc.id,
      doc.rag_project_id,
      additionalMetadata
    );

    if (generatedChunks.length === 0) {
      throw new Error('Replicate OCR 텍스트 정제 후 생성된 청크가 없습니다.');
    }

    // 5. 기존 청크 삭제 (기존 깨진 4개 청크 등 완전 교체)
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', id);

    // 6. pgvector 임베딩 생성 (1536차원)
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
      embedding: embeddings[idx],
    }));

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

    // 8. 문서 상태를 INDEXED로 업데이트 및 OCR 메타데이터 기록
    const updatedMetadata = {
      ...(doc.metadata || {}),
      ocr_processed: true,
      ocr_provider: 'replicate-marker',
      ocr_at: new Date().toISOString(),
      ocr_chars: ocrResult.markdown.length,
      ocr_chunks: generatedChunks.length,
    };

    await supabase
      .from('documents')
      .update({
        status: 'INDEXED',
        metadata: updatedMetadata,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      documentId: id,
      chunksCount: generatedChunks.length,
      totalChars: ocrResult.markdown.length,
      markdownPreview: ocrResult.markdown.slice(0, 300),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Replicate OCR 처리 중 서버 오류';
    console.error('Replicate OCR error:', err);

    // 실패 시 문서 상태를 ERROR로 업데이트하여 UI에 명확히 표기
    try {
      const { id } = await params;
      if (id && isSupabaseAdminConfigured()) {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('documents')
          .update({ status: 'ERROR', error_message: message })
          .eq('id', id);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
