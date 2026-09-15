import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { ChunkAgentTools } from '@/services/chunking-agent/tools';
import { getEmbeddingProvider } from '@/lib/embedding';
import { EmbeddingContentBuilder } from '@/services/ingestion/embedding/embedding-content-builder';
import { TokenCounter } from '@/lib/chunking/token-counter';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });

    const proposals = await ChunkAgentTools.getProposals(id);
    if (proposals.length === 0) {
      return NextResponse.json({ error: '인덱싱할 청크 제안이 없습니다.' }, { status: 400 });
    }

    const supabase = isSupabaseAdminConfigured() ? getSupabaseAdmin() : null;

    let doc: any = null;
    if (supabase) {
      const { data } = await supabase.from('documents').select('*').eq('id', id).single();
      doc = data;

      await supabase.from('documents').update({ status: 'EMBEDDING' }).eq('id', id);
    }

    const docTitle = doc?.title || '문서';
    const domain = doc?.metadata?.domain || 'health';

    // 1. Embedding Content 합성 및 벡터 생성 준비
    const embeddingTexts: string[] = [];
    const enrichedProposals = proposals.map((p, idx) => {
      const contextText = `${docTitle}의 [${p.section_path?.join(' > ') || p.title}] 영역으로, ${p.category || domain} 관련 지식을 다룹니다.`;

      const embeddingContent = EmbeddingContentBuilder.build({
        documentTitle: docTitle,
        domain,
        sectionPath: p.section_path || [p.title],
        contextText,
        content: p.proposed_content,
      });

      embeddingTexts.push(embeddingContent);

      return {
        ...p,
        context_text: contextText,
        embedding_content: embeddingContent,
      };
    });

    // 2. 1536차원 벡터 임베딩 일괄 생성 (OpenAI / Gemini / Mock)
    const embeddingProvider = getEmbeddingProvider();
    const embeddings = await embeddingProvider.embedBatch(embeddingTexts);

    // 3. document_chunks 레코드 구성 (Knowledge Object)
    const chunkRecords = enrichedProposals.map((p, idx) => ({
      document_id: id,
      rag_project_id: doc?.rag_project_id || 'default',
      chunk_index: p.proposed_index || idx + 1,
      content: p.proposed_content, // 순수 원문 본문
      token_count: p.token_count || TokenCounter.count(p.proposed_content),
      metadata: {
        title: p.title,
        section_title: p.title,
        section_path: p.section_path,
        chunk_type: p.chunk_type || 'paragraph',
        category: p.category,
        page: p.page_start || 1,
        page_start: p.page_start || 1,
        page_end: p.page_end || 1,
        context_text: p.context_text,
        embedding_content: p.embedding_content,
        chunking_version: 'v2',
        source: doc?.source,
        publisher: doc?.publisher,
      },
      embedding: embeddings[idx],
      section_title: p.title,
      ingestion_version: 'v2',
    }));

    // 4. DB 저장
    if (supabase) {
      // 기존 v2 청크 삭제 후 새로 승인된 청크 적재
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', id);

      const batchSize = 50;
      for (let i = 0; i < chunkRecords.length; i += batchSize) {
        const batch = chunkRecords.slice(i, i + batchSize);
        const { error: insErr } = await supabase.from('document_chunks').insert(batch);
        if (insErr) {
          throw new Error(`청크 저장 실패: ${insErr.message}`);
        }
      }

      // 문서 상태를 INDEXED 로 승격
      await supabase
        .from('documents')
        .update({
          status: 'INDEXED',
          metadata: {
            ...(doc?.metadata || {}),
            chunking_version: 'v2',
            chunks_count: chunkRecords.length,
            indexed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      // 세션 완료 처리
      await supabase
        .from('chunking_sessions')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('document_id', id);
    }

    // 제안 상태 전체 APPROVED 처리
    proposals.forEach((p) => {
      p.status = 'APPROVED';
    });
    await ChunkAgentTools.saveProposals(id, proposals);

    return NextResponse.json({
      success: true,
      message: `총 ${chunkRecords.length}개의 청크가 최종 승인되어 RAG Index로 구축되었습니다.`,
      chunksCount: chunkRecords.length,
      documentId: id,
    });
  } catch (err: unknown) {
    console.error('[Chunk Agent Apply] 오류:', err);
    const message = err instanceof Error ? err.message : '적용 처리 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
