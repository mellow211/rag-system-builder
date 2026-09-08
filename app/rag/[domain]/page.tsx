import React from 'react';
import { notFound } from 'next/navigation';
import { DomainType, RagDocument } from '@/types/rag';
import { getProjectByDomain } from '@/lib/supabase/projects';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DomainClientView } from './DomainClientView';

export const dynamic = 'force-dynamic';

interface DomainPageProps {
  params: Promise<{
    domain: string;
  }>;
}

export default async function DomainRagPage({ params }: DomainPageProps) {
  const { domain } = await params;
  const validDomains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];

  if (!validDomains.includes(domain as DomainType)) {
    notFound();
  }

  const domainType = domain as DomainType;
  const project = await getProjectByDomain(domainType);

  let initialDocuments: RagDocument[] = [];

  if (isSupabaseAdminConfigured() && project) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('rag_project_id', project.id)
        .order('created_at', { ascending: false });

      if (docs) {
        // 청크 수 집계
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('document_id')
          .eq('rag_project_id', project.id);

        const countMap: Record<string, number> = {};
        if (chunks) {
          for (const c of chunks) {
            countMap[c.document_id] = (countMap[c.document_id] || 0) + 1;
          }
        }

        initialDocuments = docs.map((d) => ({
          ...d,
          chunks_count: countMap[d.id] || 0,
        })) as RagDocument[];
      }
    } catch (e) {
      console.error('초기 문서 로딩 실패:', e);
    }
  }

  return (
    <DomainClientView
      domain={domainType}
      project={project}
      initialDocuments={initialDocuments}
    />
  );
}
