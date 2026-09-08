import { NextRequest, NextResponse } from 'next/server';
import { ingestionPipeline } from '@/services/ingestion/pipeline';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    const result = await ingestionPipeline.processDocumentChunks(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '텍스트 추출 및 청킹 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId: id,
      chunksCount: result.chunksCount,
      totalTextLength: result.totalTextLength,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
