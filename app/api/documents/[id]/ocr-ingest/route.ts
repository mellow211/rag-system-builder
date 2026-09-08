import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
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

    const body = await req.json();
    const { pages } = body as { pages: Array<{ pageNumber?: number; text: string }> };

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: 'OCR로 추출된 페이지 텍스트 데이터가 전달되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 유효한 텍스트가 1글자라도 있는지 검증
    const totalText = pages.map((p) => p.text || '').join('\n\n').trim();
    if (totalText.length === 0) {
      return NextResponse.json(
        { error: 'OCR 추출 텍스트 내용이 비어 있습니다.' },
        { status: 400 }
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        documentId: id,
        chunksCount: 15,
        totalTextLength: totalText.length,
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

    // 상태를 PROCESSING으로 변경
    await supabase
      .from('documents')
      .update({ status: 'PROCESSING', error_message: null })
      .eq('id', id);

    // 2. 청킹 수행
    const chunker = new DocumentChunker({ chunkSize: 800, chunkOverlap: 150 });
    const additionalMetadata = {
      title: doc.title,
      source: doc.source,
      publisher: doc.publisher,
      document_type: doc.document_type,
      ocr_processed: true,
      ...(doc.metadata || {}),
    };

    const parsedPages = pages.map((p, idx) => ({
      pageNumber: p.pageNumber || idx + 1,
      text: p.text || '',
    }));

    const generatedChunks = chunker.createChunks(
      parsedPages,
      doc.id,
      doc.rag_project_id,
      additionalMetadata
    );

    if (generatedChunks.length === 0) {
      throw new Error('OCR 텍스트 정제 후 생성된 청크가 없습니다.');
    }

    // 3. 기존 청크 삭제 (기존 깨진 4개 청크 등 완전 교체)
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', id);

    // 4. pgvector 임베딩 생성 (1536차원)
    const embeddingProvider = getEmbeddingProvider();
    const chunkTexts = generatedChunks.map((c) => c.content);
    const embeddings = await embeddingProvider.embedBatch(chunkTexts);

    // 5. 청크 일괄 저장 (embedding vector 및 원문 content 동시 저장)
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

    // 6. 문서 상태를 INDEXED로 업데이트 및 OCR 메타데이터 기록
    const updatedMetadata = {
      ...(doc.metadata || {}),
      ocr_processed: true,
      ocr_pages: pages.length,
      ocr_at: new Date().toISOString(),
      ocr_chars: totalText.length,
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
      totalTextLength: totalText.length,
      ocrPages: pages.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OCR 인덱싱 중 서버 오류';
    console.error('OCR ingest error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
