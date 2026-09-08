import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getProjectByDomain } from '@/lib/supabase/projects';
import { DomainType } from '@/types/rag';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain') as DomainType | null;

    if (!domain) {
      return NextResponse.json({ error: 'domain 파라미터가 필요합니다.' }, { status: 400 });
    }

    const project = await getProjectByDomain(domain);
    if (!project) {
      return NextResponse.json({ documents: [] });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({
        isMock: true,
        documents: [],
      });
    }

    const supabase = getSupabaseAdmin();

    // 1. 해당 프로젝트의 문서 목록 조회
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('rag_project_id', project.id)
      .order('created_at', { ascending: false });

    if (docError) {
      console.error('문서 목록 조회 실패:', docError);
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // 2. 문서별 청크 수 집계
    const docIds = (documents || []).map((d) => d.id);
    const chunkCountsMap: Record<string, number> = {};

    if (docIds.length > 0) {
      const { data: chunkCounts, error: chunkErr } = await supabase
        .from('document_chunks')
        .select('document_id');

      if (!chunkErr && chunkCounts) {
        for (const item of chunkCounts) {
          chunkCountsMap[item.document_id] = (chunkCountsMap[item.document_id] || 0) + 1;
        }
      }
    }

    const result = (documents || []).map((doc) => ({
      ...doc,
      chunks_count: chunkCountsMap[doc.id] || 0,
    }));

    return NextResponse.json({
      documents: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
