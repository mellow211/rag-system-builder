import { NextRequest, NextResponse } from 'next/server';
import { DocumentProfiler } from '@/services/intelligence/document-profiler';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST: Document Profile 강제 재분석 실행
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    const profile = await DocumentProfiler.analyzeDocument(id, { forceReanalyze: true });

    return NextResponse.json({
      success: true,
      message: 'LLM Document Profile 재분석이 성공적으로 완료되었습니다.',
      profile,
    });
  } catch (err: unknown) {
    console.error('[Profile Analyze API] POST 오류:', err);
    const message = err instanceof Error ? err.message : '프로파일 재분석 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
