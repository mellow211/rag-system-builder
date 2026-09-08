import { NextRequest, NextResponse } from 'next/server';
import { ingestionPipeline } from '@/services/ingestion/pipeline';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';

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
        message: 'Mock 환경에서 재인덱싱이 완료되었습니다.',
        chunksCount: 3,
      });
    }

    // 파이프라인 재실행 (기존 청크 삭제 -> 재파싱 -> 재청킹 -> 임베딩 -> INDEXED)
    const result = await ingestionPipeline.processDocumentChunks(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '재인덱싱 처리 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '재인덱싱이 성공적으로 완료되었습니다.',
      chunksCount: result.chunksCount,
      totalTextLength: result.totalTextLength,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
