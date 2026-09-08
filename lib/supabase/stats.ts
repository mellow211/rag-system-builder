import { getSupabaseAdmin, isSupabaseAdminConfigured } from './admin';
import { ensureDefaultRagProjects } from './projects';
import { DOMAIN_CONFIGS, DomainStats, DomainType, OverallStats, RagDocument } from '@/types/rag';

export async function getDashboardStats(): Promise<OverallStats> {
  const domains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];
  
  // 기본 빈 통계 구조
  const initialDomainStats = domains.reduce((acc, domain) => {
    acc[domain] = {
      domain,
      name: DOMAIN_CONFIGS[domain].name,
      documentCount: 0,
      chunkCount: 0,
      indexedCount: 0,
      errorCount: 0,
      lastUpdated: null,
    };
    return acc;
  }, {} as Record<DomainType, DomainStats>);

  if (!isSupabaseAdminConfigured()) {
    return {
      totalDocuments: 0,
      totalChunks: 0,
      indexedDocuments: 0,
      errorDocuments: 0,
      domainStats: initialDomainStats,
      recentDocuments: [],
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const projects = await ensureDefaultRagProjects();
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const domainToProjectMap = new Map(projects.map((p) => [p.domain, p]));

    // 1. 전체 문서 조회 (최신순 50개)
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('문서 통계 조회 오류:', docsError);
      return {
        totalDocuments: 0,
        totalChunks: 0,
        indexedDocuments: 0,
        errorDocuments: 0,
        domainStats: initialDomainStats,
        recentDocuments: [],
      };
    }

    const docList = (documents || []) as RagDocument[];

    // 2. 청크 수 집계
    const { data: chunksCountData, error: chunkError } = await supabase
      .from('document_chunks')
      .select('rag_project_id, id');

    const chunkCountsByProject: Record<string, number> = {};
    if (!chunkError && chunksCountData) {
      for (const item of chunksCountData) {
        chunkCountsByProject[item.rag_project_id] = (chunkCountsByProject[item.rag_project_id] || 0) + 1;
      }
    }

    // 도메인별 통계 채우기
    let totalDocs = 0;
    let totalChunks = 0;
    let indexedDocs = 0;
    let errorDocs = 0;

    for (const domain of domains) {
      const proj = domainToProjectMap.get(domain);
      if (!proj) continue;

      const domainDocs = docList.filter((d) => d.rag_project_id === proj.id);
      const docCount = domainDocs.length;
      const chCount = chunkCountsByProject[proj.id] || 0;
      const idxCount = domainDocs.filter((d) => d.status === 'INDEXED').length;
      const errCount = domainDocs.filter((d) => d.status === 'ERROR').length;
      const lastDoc = domainDocs[0];

      initialDomainStats[domain] = {
        domain,
        name: DOMAIN_CONFIGS[domain].name,
        documentCount: docCount,
        chunkCount: chCount,
        indexedCount: idxCount,
        errorCount: errCount,
        lastUpdated: lastDoc?.updated_at || lastDoc?.created_at || null,
      };

      totalDocs += docCount;
      totalChunks += chCount;
      indexedDocs += idxCount;
      errorDocs += errCount;
    }

    return {
      totalDocuments: totalDocs,
      totalChunks: totalChunks,
      indexedDocuments: indexedDocs,
      errorDocuments: errorDocs,
      domainStats: initialDomainStats,
      recentDocuments: docList.slice(0, 5),
    };
  } catch (error) {
    console.error('getDashboardStats 실패:', error);
    return {
      totalDocuments: 0,
      totalChunks: 0,
      indexedDocuments: 0,
      errorDocuments: 0,
      domainStats: initialDomainStats,
      recentDocuments: [],
    };
  }
}
