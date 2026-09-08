import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getProjectByDomain } from '@/lib/supabase/projects';
import { DomainType, DocumentType } from '@/types/rag';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB 허용

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      filename,
      fileSize,
      fileType,
      title,
      domain,
      source,
      publisher,
      publishedAt,
      documentType = '기타',
      sourceUrl,
      keywords = [],
      description,
    } = body;

    // 유효성 검사
    if (!filename || !title || !domain) {
      return NextResponse.json(
        { error: '제목, 분야(도메인), 파일명은 필수 항목입니다.' },
        { status: 400 }
      );
    }

    const validDomains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];
    if (!validDomains.includes(domain)) {
      return NextResponse.json({ error: '유효하지 않은 도메인입니다.' }, { status: 400 });
    }

    const fileExt = '.' + filename.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['.pdf', '.txt', '.md', '.markdown'];
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. (PDF, TXT, MD 파일만 업로드 가능)' },
        { status: 400 }
      );
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일 크기는 최대 50MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    const project = await getProjectByDomain(domain);
    if (!project) {
      return NextResponse.json(
        { error: '해당 도메인의 RAG 프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 고유 파일 경로 생성
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${domain}/${Date.now()}_${sanitizedFilename}`;

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({
        documentId: `mock-doc-${Date.now()}`,
        storagePath,
        signedUrl: null,
        token: null,
        isMock: true,
      });
    }

    const supabase = getSupabaseAdmin();

    // 1. documents 테이블에 메타데이터 레코드 선등록 (status = 'UPLOADED')
    const { data: newDoc, error: dbError } = await supabase
      .from('documents')
      .insert({
        rag_project_id: project.id,
        title: title.trim(),
        filename,
        storage_path: storagePath,
        file_size: fileSize || 0,
        mime_type: fileType || 'application/octet-stream',
        source: source?.trim() || null,
        publisher: publisher?.trim() || null,
        source_url: sourceUrl?.trim() || null,
        document_type: documentType,
        published_at: publishedAt || null,
        version: '1.0',
        status: 'UPLOADED',
        metadata: {
          keywords: Array.isArray(keywords) ? keywords : [],
          description: description?.trim() || null,
        },
      })
      .select('id')
      .single();

    if (dbError || !newDoc) {
      console.error('documents 레코드 선등록 실패:', dbError);
      return NextResponse.json(
        { error: `문서 메타데이터 등록 실패: ${dbError?.message}` },
        { status: 500 }
      );
    }

    // 2. Supabase Storage 1회용 Signed Upload URL 생성
    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUploadUrl(storagePath);

    if (signedError || !signedData) {
      console.error('Signed Upload URL 생성 실패:', signedError);
      // 레코드 정리
      await supabase.from('documents').delete().eq('id', newDoc.id);
      return NextResponse.json(
        { error: `스토리지 업로드 URL 생성 실패: ${signedError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentId: newDoc.id,
      storagePath: signedData.path,
      signedUrl: signedData.signedUrl,
      token: signedData.token,
    });
  } catch (err: unknown) {
    console.error('prepare-upload API 예외:', err);
    const message = err instanceof Error ? err.message : '알 수 없는 서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
