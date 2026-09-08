import { getSupabaseAdmin, isSupabaseAdminConfigured } from './admin';
import { DOMAIN_CONFIGS, DomainType, RagProject } from '@/types/rag';

export const DEFAULT_PROJECTS: Omit<RagProject, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: '건강정보 RAG',
    domain: 'health',
    description: '고령자 만성질환, 영양관리, 운동가이드 등 보건복지/의학 건강정보',
    color_theme: 'blue',
    status: 'ACTIVE',
  },
  {
    name: '양생 RAG',
    domain: 'yangsaeng',
    description: '전통 양생법, 식이요법, 계절별 건강관리 및 섭생 지식',
    color_theme: 'green',
    status: 'ACTIVE',
  },
  {
    name: '일주기리듬 RAG',
    domain: 'circadian',
    description: '수면 위생, 생체시계, 채광 및 일상 활동 주기 건강 지식',
    color_theme: 'orange',
    status: 'ACTIVE',
  },
  {
    name: '한의문진 RAG',
    domain: 'korean-medicine',
    description: '한의학 변증, 사상체질, 문진 질문 및 임상 평가 지표',
    color_theme: 'purple',
    status: 'ACTIVE',
  },
];

/**
 * 4개 RAG 프로젝트를 조회하거나, DB에 없으면 자동으로 생성(Upsert)하여 반환합니다.
 */
export async function ensureDefaultRagProjects(): Promise<RagProject[]> {
  if (!isSupabaseAdminConfigured()) {
    // 환경변수 미설정 시 가상 ID를 부여한 기본 프로젝트 목록 반환
    return DEFAULT_PROJECTS.map((proj, idx) => ({
      ...proj,
      id: `mock-project-id-${idx + 1}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  const supabase = getSupabaseAdmin();

  // 기존 프로젝트 조회
  const { data: existing, error: selectError } = await supabase
    .from('rag_projects')
    .select('*')
    .order('created_at', { ascending: true });

  if (selectError) {
    console.error('rag_projects 조회 실패:', selectError);
    return DEFAULT_PROJECTS.map((proj, idx) => ({
      ...proj,
      id: `fallback-project-id-${idx + 1}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  const existingMap = new Map((existing || []).map((p) => [p.domain, p]));
  const projectsToInsert = DEFAULT_PROJECTS.filter((p) => !existingMap.has(p.domain));

  if (projectsToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('rag_projects')
      .insert(projectsToInsert)
      .select('*');

    if (insertError) {
      console.error('rag_projects 초기 데이터 생성 실패:', insertError);
    } else if (inserted) {
      inserted.forEach((p) => existingMap.set(p.domain, p));
    }
  }

  // 4대 도메인 순서대로 정렬하여 반환
  const orderedDomains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];
  return orderedDomains.map((domain) => {
    const found = existingMap.get(domain);
    if (found) return found as RagProject;
    const def = DOMAIN_CONFIGS[domain];
    return {
      id: `default-${domain}`,
      name: def.name,
      domain: def.domain,
      description: def.description,
      color_theme: def.themeColor,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
}

/**
 * 도메인 코드로 프로젝트 단일 조회
 */
export async function getProjectByDomain(domain: DomainType): Promise<RagProject | null> {
  const projects = await ensureDefaultRagProjects();
  return projects.find((p) => p.domain === domain) || null;
}
