import { getSupabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { CategoryItem, KnowledgeNode, KnowledgeEdge, DomainType } from '@/types/rag';
import { GraphExtractor } from './extractor';

export interface CrossDomainBridge {
  concept: string;
  sourceDomain: DomainType;
  targetDomain: DomainType;
  relationType: string;
  rationale: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export class KnowledgeFabricService {
  private static inMemoryCategories: CategoryItem[] = [
    // 일주기리듬
    { id: 'cat-circadian-1', name: '일주기리듬', domain: 'circadian', status: 'APPROVED' },
    { id: 'cat-circadian-2', name: '수면 위생', parent_id: 'cat-circadian-1', domain: 'circadian', status: 'APPROVED' },
    { id: 'cat-circadian-3', name: '수면 시간', parent_id: 'cat-circadian-2', domain: 'circadian', status: 'APPROVED' },
    { id: 'cat-circadian-4', name: '야간 각성', parent_id: 'cat-circadian-2', domain: 'circadian', status: 'APPROVED' },
    { id: 'cat-circadian-5', name: '수면 효율', parent_id: 'cat-circadian-2', domain: 'circadian', status: 'APPROVED' },
    { id: 'cat-circadian-6', name: '빛과 환경', parent_id: 'cat-circadian-1', domain: 'circadian', status: 'APPROVED' },
    { id: 'cat-circadian-7', name: '아침 빛', parent_id: 'cat-circadian-6', domain: 'circadian', status: 'APPROVED' },
    { id: 'cat-circadian-8', name: '저녁 조명', parent_id: 'cat-circadian-6', domain: 'circadian', status: 'APPROVED' },
    { id: 'cat-circadian-9', name: '광치료', parent_id: 'cat-circadian-6', domain: 'circadian', status: 'PROPOSED', description: '에이전트 확장 제안 카테고리' },

    // 건강정보
    { id: 'cat-health-1', name: '만성질환', domain: 'health', status: 'APPROVED' },
    { id: 'cat-health-2', name: '혈압 관리', parent_id: 'cat-health-1', domain: 'health', status: 'APPROVED' },
    { id: 'cat-health-3', name: '혈당 관리', parent_id: 'cat-health-1', domain: 'health', status: 'APPROVED' },
    { id: 'cat-health-4', name: '신체활동', domain: 'health', status: 'APPROVED' },
    { id: 'cat-health-5', name: '유산소 운동', parent_id: 'cat-health-4', domain: 'health', status: 'APPROVED' },

    // 양생
    { id: 'cat-yangsaeng-1', name: '사시 섭생', domain: 'yangsaeng', status: 'APPROVED' },
    { id: 'cat-yangsaeng-2', name: '기거 양생', parent_id: 'cat-yangsaeng-1', domain: 'yangsaeng', status: 'APPROVED' },
    { id: 'cat-yangsaeng-3', name: '조와조기', parent_id: 'cat-yangsaeng-2', domain: 'yangsaeng', status: 'APPROVED' },

    // 한의문진
    { id: 'cat-km-1', name: '사상체질', domain: 'korean-medicine', status: 'APPROVED' },
    { id: 'cat-km-2', name: '체질별 수면 양상', parent_id: 'cat-km-1', domain: 'korean-medicine', status: 'APPROVED' },
  ];

  /**
   * 도메인별 계층형 카테고리 트리를 반환합니다.
   */
  public static async getCategoryTree(domain?: DomainType): Promise<CategoryItem[]> {
    let allCategories = [...this.inMemoryCategories];

    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const query = supabase.from('categories').select('*');
        if (domain) query.eq('domain', domain);
        const { data } = await query;
        if (data && data.length > 0) {
          allCategories = data as CategoryItem[];
        }
      } catch (e) {
        console.warn('[KnowledgeFabric] Category DB 조회 폴백:', e);
      }
    }

    const filtered = domain ? allCategories.filter((c) => c.domain === domain) : allCategories;

    // 트리 구조로 조립
    const itemMap = new Map<string, CategoryItem>();
    filtered.forEach((item) => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    const roots: CategoryItem[] = [];
    itemMap.forEach((item) => {
      if (item.parent_id && itemMap.has(item.parent_id)) {
        itemMap.get(item.parent_id)!.children!.push(item);
      } else {
        roots.push(item);
      }
    });

    return roots;
  }

  /**
   * 4대 도메인을 넘나드는 교차 연결(Knowledge Fabric Cross-domain Bridges)을 생성합니다.
   */
  public static async getCrossDomainBridges(): Promise<CrossDomainBridge[]> {
    return [
      {
        concept: '수면 (Sleep)',
        sourceDomain: 'circadian',
        targetDomain: 'health',
        relationType: 'influences',
        rationale: '일주기 수면 위생 개선은 고령자 혈압 및 대사증후군 조절에 긍정적 영향',
        sourceNodeId: 'node-circadian-수면',
        targetNodeId: 'node-health-수축기_혈압',
      },
      {
        concept: '신체활동 (Physical Activity)',
        sourceDomain: 'health',
        targetDomain: 'circadian',
        relationType: 'regulates',
        rationale: '낮 시간 30분 유산소 운동은 야간 중심체온 하강 및 멜라토닌 리듬 동기화 촉진',
        sourceNodeId: 'node-health-신체활동',
        targetNodeId: 'node-circadian-일주기리듬',
      },
      {
        concept: '조와조기 (早臥早起)',
        sourceDomain: 'yangsaeng',
        targetDomain: 'circadian',
        relationType: 'related_to',
        rationale: '전통 계절별 수면 기거 양생법과 현대 일주기 생체시계 조절 원리의 상통',
        sourceNodeId: 'node-yangsaeng-조와조기',
        targetNodeId: 'node-circadian-수면',
      },
      {
        concept: '사상체질 (Constitutional Medicine)',
        sourceDomain: 'korean-medicine',
        targetDomain: 'circadian',
        relationType: 'affects',
        rationale: '소음인의 비위허약 불면 및 태음인의 다수면(多睡眠) 특성 감별 진단',
        sourceNodeId: 'node-km-사상체질',
        targetNodeId: 'node-circadian-수면_효율',
      },
    ];
  }

  /**
   * 지식 패브릭 전체 그래프(노드 및 엣지)를 조회합니다.
   */
  public static async getGlobalFabricGraph(filterDomain?: DomainType): Promise<{
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    bridges: CrossDomainBridge[];
  }> {
    const bridges = await this.getCrossDomainBridges();

    // 기본 노드 목록
    const defaultNodes: KnowledgeNode[] = [
      { id: 'node-circadian-일주기리듬', canonical_name: '일주기리듬', node_type: 'concept', domain: 'circadian', description: '24시간 생체시계 조절 메커니즘', aliases: ['생체리듬', '서카디안'], status: 'APPROVED' },
      { id: 'node-circadian-수면', canonical_name: '수면', node_type: 'concept', domain: 'circadian', description: '생체 회복 상태', aliases: ['잠', '수면상태'], status: 'APPROVED' },
      { id: 'node-circadian-빛_노출', canonical_name: '빛 노출', node_type: 'factor', domain: 'circadian', description: '시교차상핵 동기화 외생 인자', aliases: ['햇빛', '자연광'], status: 'APPROVED' },
      { id: 'node-circadian-멜라토닌', canonical_name: '멜라토닌', node_type: 'metric', domain: 'circadian', description: '수면 유도 송과체 호르몬', aliases: ['멜라토닌 수치'], status: 'APPROVED' },
      { id: 'node-health-신체활동', canonical_name: '신체활동', node_type: 'factor', domain: 'health', description: '유산소 및 근력 운동', aliases: ['운동', '보행'], status: 'APPROVED' },
      { id: 'node-health-수축기_혈압', canonical_name: '수축기 혈압', node_type: 'metric', domain: 'health', description: '심혈관 건강 지표', aliases: ['혈압'], status: 'APPROVED' },
      { id: 'node-yangsaeng-조와조기', canonical_name: '조와조기', node_type: 'concept', domain: 'yangsaeng', description: '일찍 자고 일찍 일어나는 섭생법', aliases: ['기거양생'], status: 'APPROVED' },
      { id: 'node-km-사상체질', canonical_name: '사상체질', node_type: 'concept', domain: 'korean-medicine', description: '소음/태음/소양/태양 체질론', aliases: ['체질의학'], status: 'APPROVED' },
    ];

    const defaultEdges: KnowledgeEdge[] = [
      { id: 'edge-1', source_node_id: 'node-circadian-빛_노출', target_node_id: 'node-circadian-일주기리듬', relation_type: 'influences', confidence: 0.95, evidence_text: '아침 빛 노출은 일주기 생체리듬을 동기화함.', status: 'APPROVED' },
      { id: 'edge-2', source_node_id: 'node-circadian-일주기리듬', target_node_id: 'node-circadian-수면', relation_type: 'affects', confidence: 0.92, evidence_text: '일주기리듬 안정은 야간 수면 질을 결정함.', status: 'APPROVED' },
      { id: 'edge-3', source_node_id: 'node-health-신체활동', target_node_id: 'node-circadian-수면', relation_type: 'associated_with', confidence: 0.89, evidence_text: '주간 신체활동은 수면 효율을 증진시킴.', status: 'APPROVED' },
    ];

    let nodes = defaultNodes;
    let edges = defaultEdges;

    if (filterDomain) {
      nodes = nodes.filter((n) => n.domain === filterDomain);
      const nodeIds = new Set(nodes.map((n) => n.id));
      edges = edges.filter((e) => nodeIds.has(e.source_node_id) && nodeIds.has(e.target_node_id));
    }

    return { nodes, edges, bridges };
  }
}
