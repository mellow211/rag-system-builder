import React from 'react';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DocumentDetailClient } from './DocumentDetailClient';
import { RagDocument, DocumentChunk, DomainType } from '@/types/rag';

export const dynamic = 'force-dynamic';

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DocumentDetailPage({ params }: DocumentPageProps) {
  const { id } = await params;
  if (!id) notFound();

  let document: RagDocument | null = null;
  let chunks: DocumentChunk[] = [];
  let domain: DomainType = 'health';

  if (!isSupabaseAdminConfigured()) {
    // Supabase 미설정 시 Mock 문서 및 청크 뷰 제공
    document = {
      id,
      rag_project_id: 'mock-proj-1',
      title: '고령자 일상 건강관리 임상 가이드 2024',
      filename: 'sample_health_guide.pdf',
      storage_path: 'health/sample.pdf',
      file_size: 1024 * 350,
      mime_type: 'application/pdf',
      source: '질병관리청 노인건강포털',
      publisher: '질병관리청',
      source_url: 'https://kdca.go.kr',
      document_type: '가이드라인',
      published_at: '2024-03-15',
      version: '1.0',
      status: 'INDEXED',
      metadata: {
        keywords: ['고령자', '수면', '운동', '식이'],
        description: '만 65세 이상 고령자를 위한 수분 섭취, 규칙적인 유산소 운동 및 수면 주기 가이드라인입니다.',
      },
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    chunks = [
      {
        id: 'mock-chunk-1',
        document_id: id,
        rag_project_id: 'mock-proj-1',
        chunk_index: 0,
        content:
          '제1장 고령자의 일상 수면 및 건강 유지\n\n만 65세 이상 어르신의 건강 유지를 위해서는 일일 7~8시간의 규칙적인 수면이 필수적입니다. 특히 아침 기상 시간을 일정하게 유지하고 오전 중 30분가량 햇볕을 쬐는 것은 멜라토닌 분비 정상화와 일주기리듬 조율에 큰 도움을 줍니다.',
        token_count: 120,
        metadata: {
          page: 1,
          char_length: 185,
          source: '질병관리청 노인건강포털',
        },
        created_at: new Date().toISOString(),
      },
      {
        id: 'mock-chunk-2',
        document_id: id,
        rag_project_id: 'mock-proj-1',
        chunk_index: 1,
        content:
          '제2장 식이요법과 수분 섭취 권고사항\n\n노년기에는 갈증 감지 능력이 저하되어 탈수 위험이 높아지므로, 갈증을 느끼지 않더라도 하루 1.5리터 이상의 미온수를 소량씩 자주 섭취하도록 권고합니다. 단백질은 체중 1kg당 1.0~1.2g 수준으로 매 끼니 나누어 섭취하는 것이 근감소증 예방에 좋습니다.',
        token_count: 140,
        metadata: {
          page: 2,
          char_length: 210,
          source: '질병관리청 노인건강포털',
        },
        created_at: new Date().toISOString(),
      },
    ];
  } else {
    try {
      const supabase = getSupabaseAdmin();

      // 1. 문서 조회
      const { data: docData, error: docErr } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (docErr || !docData) {
        notFound();
      }

      document = docData as RagDocument;

      // 2. 도메인 확인
      const { data: project } = await supabase
        .from('rag_projects')
        .select('domain')
        .eq('id', document.rag_project_id)
        .single();

      if (project?.domain) {
        domain = project.domain as DomainType;
      }

      // 3. 청크 목록 조회 (문서의 활성 chunking_version에 맞추어 우선 조회)
      const docVersion = (document.metadata?.chunking_version as string) || 'v1';
      let chunkQuery = supabase
        .from('document_chunks')
        .select('id, document_id, rag_project_id, chunk_index, content, token_count, metadata, created_at')
        .eq('document_id', id);

      if (docVersion === 'v2') {
        chunkQuery = chunkQuery.filter('metadata->>chunking_version', 'eq', 'v2');
      }

      const { data: chunkData } = await chunkQuery.order('chunk_index', { ascending: true });

      if (chunkData && chunkData.length > 0) {
        chunks = chunkData as DocumentChunk[];
      } else {
        const { data: fallbackChunks } = await supabase
          .from('document_chunks')
          .select('id, document_id, rag_project_id, chunk_index, content, token_count, metadata, created_at')
          .eq('document_id', id)
          .order('chunk_index', { ascending: true });
        chunks = (fallbackChunks || []) as DocumentChunk[];
      }
    } catch (e) {
      console.error('문서 상세 로딩 오류:', e);
      notFound();
    }
  }

  if (!document) notFound();

  return (
    <DocumentDetailClient
      document={document}
      domain={domain}
      chunks={chunks}
    />
  );
}
