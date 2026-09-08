import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getProjectByDomain } from '@/lib/supabase/projects';
import { DomainType, DocumentType } from '@/types/rag';
import { ingestionPipeline } from '@/services/ingestion/pipeline';

// 허용된 MIME 타입 및 확장자
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
  'application/octet-stream': ['.md', '.txt'], // 일부 브라우저에서 md/txt를 octet-stream으로 전송
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // 필수 필드 추출
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const domain = formData.get('domain') as DomainType | null;

    // 선택 필드 추출
    const source = (formData.get('source') as string) || null;
    const publisher = (formData.get('publisher') as string) || null;
    const sourceUrl = (formData.get('sourceUrl') as string) || null;
    const documentType = (formData.get('documentType') as DocumentType) || '기타';
    const publishedAt = (formData.get('publishedAt') as string) || null;
    const description = (formData.get('description') as string) || null;
    const keywordsStr = (formData.get('keywords') as string) || '';
    const keywords = keywordsStr
      ? keywordsStr.split(',').map((k) => k.trim()).filter(Boolean)
      : [];

    // 유효성 검사 1: 필수값
    if (!file || !title || !domain) {
      return NextResponse.json(
        { error: '제목, 분야(도메인), 파일은 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }

    // 유효성 검사 2: 도메인 확인
    const validDomains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];
    if (!validDomains.includes(domain)) {
      return NextResponse.json(
        { error: '유효하지 않은 도메인입니다.' },
        { status: 400 }
      );
    }

    // 유효성 검사 3: 파일 크기
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일 크기는 최대 20MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 유효성 검사 4: 파일 확장자 확인
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['.pdf', '.txt', '.md', '.markdown'];
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. (지원 형식: PDF, TXT, MD)' },
        { status: 400 }
      );
    }

    // 프로젝트 조회
    const project = await getProjectByDomain(domain);
    if (!project) {
      return NextResponse.json(
        { error: '해당 도메인의 RAG 프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 파일 이름 새니타이징 및 고유 저장 경로 생성
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${domain}/${Date.now()}_${sanitizedFilename}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Supabase 설정 여부 확인
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        isMock: true,
        message: 'Supabase 미연동 환경입니다. .env.local 설정 후 실제 Storage/DB에 저장됩니다.',
        document: {
          id: `mock-doc-${Date.now()}`,
          rag_project_id: project.id,
          title,
          filename: file.name,
          storage_path: storagePath,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          source,
          publisher,
          source_url: sourceUrl,
          document_type: documentType,
          published_at: publishedAt,
          version: '1.0',
          status: 'INDEXED',
          chunks_count: 3,
          metadata: { keywords, description },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }

    const supabase = getSupabaseAdmin();

    // 1. Supabase Storage에 원본 파일 업로드
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (storageError) {
      console.error('Storage 업로드 실패:', storageError);
      return NextResponse.json(
        { error: `스토리지 업로드 실패: ${storageError.message}` },
        { status: 500 }
      );
    }

    // 2. documents 테이블에 메타데이터 레코드 삽입 (status = 'UPLOADED')
    const { data: newDoc, error: dbError } = await supabase
      .from('documents')
      .insert({
        rag_project_id: project.id,
        title,
        filename: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        source,
        publisher,
        source_url: sourceUrl,
        document_type: documentType,
        published_at: publishedAt,
        version: '1.0',
        status: 'UPLOADED',
        metadata: {
          keywords,
          description,
        },
      })
      .select('*')
      .single();

    if (dbError) {
      console.error('documents 테이블 저장 실패:', dbError);
      // DB 저장 실패 시 스토리지 파일 정리
      await supabase.storage.from('documents').remove([storagePath]);
      return NextResponse.json(
        { error: `데이터베이스 저장 실패: ${dbError.message}` },
        { status: 500 }
      );
    }

    // 3. 업로드 성공 후 즉시 Text Extraction 및 Chunking 파이프라인 실행
    try {
      const chunkResult = await ingestionPipeline.processDocumentChunks(newDoc.id, fileBuffer);
      return NextResponse.json({
        success: true,
        document: {
          ...newDoc,
          status: chunkResult.success ? 'PROCESSING' : 'ERROR',
          chunks_count: chunkResult.chunksCount,
        },
        chunkInfo: chunkResult,
      });
    } catch (pipelineErr) {
      console.error('업로드 후 파이프라인 실행 경고:', pipelineErr);
      return NextResponse.json({
        success: true,
        document: newDoc,
        warning: '업로드 완료되었으나 청킹 처리는 백그라운드 재시도가 필요합니다.',
      });
    }
  } catch (err: unknown) {
    console.error('문서 업로드 처리 중 예외:', err);
    const message = err instanceof Error ? err.message : '알 수 없는 서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
