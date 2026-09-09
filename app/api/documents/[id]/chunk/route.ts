import { NextRequest, NextResponse } from 'next/server';
import { ingestionPipeline } from '@/services/ingestion/pipeline';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    const comparison = await ingestionPipeline.previewComparison(id);
    return NextResponse.json(comparison);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '청크 프리뷰 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const version = (body.version as 'v1' | 'v2') || 'v2';

    const result = await ingestionPipeline.processDocumentChunks(id, undefined, { version });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '텍스트 추출 및 청킹 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId: id,
      version: result.version,
      chunksCount: result.chunksCount,
      parentChunksCount: result.parentChunksCount,
      totalTextLength: result.totalTextLength,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
