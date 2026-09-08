import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// 단일 문서 상세 조회
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Supabase가 설정되지 않았습니다.' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 단일 문서 삭제 (Storage 원본 + DB 삭제, chunks는 CASCADE 삭제)
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ success: true, message: 'Mock 환경에서 삭제되었습니다.' });
    }

    const supabase = getSupabaseAdmin();

    // 1. 기존 문서 정보 조회 (Storage 경로 확보)
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('id', id)
      .single();

    if (fetchErr || !doc) {
      return NextResponse.json({ error: '삭제할 문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. Storage 파일 삭제
    if (doc.storage_path) {
      const { error: storageErr } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (storageErr) {
        console.warn('Storage 파일 삭제 경고 (진행 계속):', storageErr);
      }
    }

    // 3. documents 테이블에서 삭제 (FK CASCADE로 document_chunks 자동 삭제됨)
    const { error: deleteErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      return NextResponse.json(
        { error: `문서 삭제 실패: ${deleteErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '문서 및 관련 청크, 스토리지가 성공적으로 삭제되었습니다.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
