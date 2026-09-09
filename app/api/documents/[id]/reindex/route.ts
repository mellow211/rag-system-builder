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

    const body = await req.json().catch(() => ({}));
    const version = (body.version as 'v1' | 'v2') || 'v2';

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        message: `Mock 환경에서 ${version.toUpperCase()} 재인덱싱이 완료되었습니다.`,
        chunksCount: 3,
        version,
      });
    }

    // 파이프라인 재실행 (지정된 버전으로 재파싱 -> 재청킹 -> 임베딩 -> INDEXED)
    const result = await ingestionPipeline.processDocumentChunks(id, undefined, { version });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '재인덱싱 처리 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `RAG ${version.toUpperCase()} 재인덱싱이 성공적으로 완료되었습니다.`,
      chunksCount: result.chunksCount,
      parentChunksCount: result.parentChunksCount,
      totalTextLength: result.totalTextLength,
      version: result.version,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
