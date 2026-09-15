import { NextRequest, NextResponse } from 'next/server';
import { DocumentProfiler } from '@/services/intelligence/document-profiler';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET: Document Profile 조회
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    let profile = await DocumentProfiler.getProfile(id);

    // 아직 프로파일이 생성되지 않은 문서라면 자동 1회 분석 수행
    if (!profile) {
      profile = await DocumentProfiler.analyzeDocument(id);
    }

    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    console.error('[Profile API] GET 오류:', err);
    const message = err instanceof Error ? err.message : '프로파일 조회 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: Document Profile 수정 및 승인(확정)
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '문서 ID가 필요합니다.' }, { status: 400 });
    }

    const body = await req.json();
    const { profileData, approve = false } = body;

    if (!profileData) {
      return NextResponse.json({ error: '수정할 profileData가 필요합니다.' }, { status: 400 });
    }

    const updated = await DocumentProfiler.updateProfile(id, profileData, approve);

    return NextResponse.json({
      success: true,
      message: approve ? 'Document Profile이 최종 승인되었습니다. Chunk 설계 단계로 이동합니다.' : 'Document Profile이 성공적으로 수정되었습니다.',
      profile: updated,
    });
  } catch (err: unknown) {
    console.error('[Profile API] PUT 오류:', err);
    const message = err instanceof Error ? err.message : '프로파일 수정 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
