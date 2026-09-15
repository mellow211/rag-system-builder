'use client';

import React, { useState, useEffect } from 'react';
import { DomainType, KnowledgeNode, KnowledgeEdge, CategoryItem, DOMAIN_CONFIGS } from '@/types/rag';
import { CrossDomainBridge } from '@/services/knowledge-graph/fabric-service';
import {
  Network,
  FolderTree,
  GitMerge,
  Search,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  FileText,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Info,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainBadge } from '@/components/ui/DomainBadge';

export const FabricExplorer: React.FC = () => {
  const [activeDomain, setActiveDomain] = useState<DomainType | 'all'>('all');
  const [activeView, setActiveView] = useState<'graph' | 'tree' | 'bridges'>('graph');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeEdge[]>([]);
  const [bridges, setBridges] = useState<CrossDomainBridge[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'APPROVED' | 'PROPOSED'>('all');

  const domainFilter = activeDomain === 'all' ? undefined : activeDomain;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const url = domainFilter ? `/api/fabric/graph?domain=${domainFilter}` : '/api/fabric/graph';
      const catUrl = domainFilter ? `/api/fabric/categories?domain=${domainFilter}` : '/api/fabric/categories';

      const [graphRes, catRes] = await Promise.all([fetch(url), fetch(catUrl)]);

      const graphData = await graphRes.json();
      const catData = await catRes.json();

      if (graphData.success) {
        setNodes(graphData.nodes || []);
        setEdges(graphData.edges || []);
        setBridges(graphData.bridges || []);
      }

      if (catData.success) {
        setCategoryTree(catData.tree || []);
      }
    } catch (err) {
      console.error('지식 패브릭 데이터 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDomain]);

  const handleUpdateEdgeStatus = async (edgeId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/documents/doc-temp/graph/edges/${edgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setEdges((prev) =>
          prev.map((e) => (e.id === edgeId ? { ...e, status } : e))
        );
      }
    } catch (err) {
      console.error('엣지 상태 갱신 실패:', err);
    }
  };

  // 노드 필터링
  const filteredNodes = nodes.filter((node) => {
    const matchesSearch =
      node.canonical_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (node.description && node.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (node.aliases && node.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesSearch;
  });

  // 엣지 필터링
  const filteredEdges = edges.filter((edge) => {
    if (statusFilter !== 'all' && edge.status !== statusFilter) return false;
    if (selectedNodeId) {
      return edge.source_node_id === selectedNodeId || edge.target_node_id === selectedNodeId;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* 1. 상단 헤더 & 컨트롤 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">지식 패브릭 탐색기 (Knowledge Fabric Explorer)</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  4대 도메인(건강정보 · 양생 · 일주기리듬 · 한의문진)의 온톨로지 카테고리, 엔티티 노드, 근거 엣지 및 교차 도메인 브릿지
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              <span>새로고침</span>
            </button>
          </div>
        </div>

        {/* 4대 도메인 탭 */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={() => setActiveDomain('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeDomain === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
            )}
          >
            전체 도메인 (Fabric View)
          </button>
          {(Object.keys(DOMAIN_CONFIGS) as DomainType[]).map((dom) => {
            const config = DOMAIN_CONFIGS[dom];
            const isActive = activeDomain === dom;
            return (
              <button
                key={dom}
                onClick={() => setActiveDomain(dom)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  isActive
                    ? `${config.bgLightClass} ${config.textClass} font-semibold border ${config.borderClass}`
                    : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                )}
              >
                <span>{config.shortName}</span>
              </button>
            );
          })}
        </div>

        {/* 탐색 뷰 전환 탭 */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setActiveView('graph')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border',
              activeView === 'graph'
                ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            <Network className="w-3.5 h-3.5 text-indigo-600" />
            <span>지식 그래프 & 근거 엣지 ({edges.length})</span>
          </button>

          <button
            onClick={() => setActiveView('tree')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border',
              activeView === 'tree'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
            <span>계층형 카테고리 트리 ({categoryTree.length})</span>
          </button>

          <button
            onClick={() => setActiveView('bridges')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border',
              activeView === 'bridges'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            <GitMerge className="w-3.5 h-3.5 text-amber-600" />
            <span>4대 도메인 교차 브릿지 ({bridges.length})</span>
          </button>
        </div>
      </div>

      {/* 2. 통계 지표 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">전체 지식 노드</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{nodes.length}개</div>
          <div className="text-[11px] text-slate-400 mt-0.5">정규화 표준 엔티티</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">인과/상관 관계 엣지</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{edges.length}건</div>
          <div className="text-[11px] text-slate-400 mt-0.5">원문 인용 근거 보존</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">승인 완료 비율</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {edges.length > 0
              ? `${Math.round((edges.filter((e) => e.status === 'APPROVED').length / edges.length) * 100)}%`
              : '0%'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Human-in-the-loop 검증</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">교차 도메인 브릿지</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{bridges.length}개</div>
          <div className="text-[11px] text-slate-400 mt-0.5">4대 분야 통합 온톨로지</div>
        </div>
      </div>

      {/* 3. 본문 뷰 (Tab 분기) */}
      {activeView === 'graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 노드/엔티티 목록 */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Network className="w-4 h-4 text-indigo-600" />
                <span>표준 지식 노드 ({filteredNodes.length})</span>
              </h2>
              {selectedNodeId && (
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                >
                  선택 해제
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="노드 이름, 이명, 설명 검색..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const nodeEdges = edges.filter(
                  (e) => e.source_node_id === node.id || e.target_node_id === node.id
                );
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                    className={cn(
                      'p-3 rounded-lg border text-xs cursor-pointer transition-all',
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-400'
                        : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-200'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{node.canonical_name}</span>
                      <DomainBadge domain={node.domain} size="sm" />
                    </div>
                    {node.description && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{node.description}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span>유형: {node.node_type}</span>
                      <span>연결 엣지 {nodeEdges.length}개</span>
                    </div>
                    {node.aliases && node.aliases.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {node.aliases.map((alias, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 text-[9px]"
                          >
                            #{alias}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredNodes.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">검색 조건에 맞는 노드가 없습니다.</div>
              )}
            </div>
          </div>

          {/* 우측: 관계(Edges) 및 근거(Evidence) 탐색 */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>근거 기반 관계 엣지 ({filteredEdges.length}건)</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  각 관계는 원문 청크, 발췌 문장, 신뢰도(Confidence) 점수를 엄격히 보존합니다.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">상태:</span>
                {(['all', 'APPROVED', 'PROPOSED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                      statusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {st === 'all' ? '전체' : st === 'APPROVED' ? '승인' : '제안'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredEdges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source_node_id);
                const targetNode = nodes.find((n) => n.id === edge.target_node_id);

                return (
                  <div
                    key={edge.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all space-y-3"
                  >
                    {/* 관계 경로 & 상태 */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {sourceNode?.canonical_name || edge.source_node_id}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-mono">
                          [{edge.relation_type}]
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {targetNode?.canonical_name || edge.target_node_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* 신뢰도 */}
                        <div className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          신뢰도 {Math.round(edge.confidence * 100)}%
                        </div>
                        {/* 상태 뱃지 */}
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                            edge.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : edge.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          )}
                        >
                          {edge.status}
                        </span>
                      </div>
                    </div>

                    {/* 원문 근거 (Evidence) */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          원문 인용 근거 (Evidence Text)
                        </span>
                        {edge.page && <span>Page {edge.page}</span>}
                      </div>
                      <blockquote className="italic text-slate-700 border-l-2 border-indigo-400 pl-2.5 py-0.5">
                        "{edge.evidence_text}"
                      </blockquote>
                      {edge.chunk_id && (
                        <div className="mt-2 text-[10px] text-slate-400 font-mono">
                          출처 Chunk ID: {edge.chunk_id}
                        </div>
                      )}
                    </div>

                    {/* 승인 / 반려 액션 버튼 */}
                    {edge.status === 'PROPOSED' && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleUpdateEdgeStatus(edge.id, 'REJECTED')}
                          className="px-2.5 py-1 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 flex items-center gap-1 transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>반려</span>
                        </button>
                        <button
                          onClick={() => handleUpdateEdgeStatus(edge.id, 'APPROVED')}
                          className="px-2.5 py-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1 transition-colors font-semibold"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>승인 (지식 반영)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredEdges.length === 0 && (
                <div className="text-center py-12 text-xs text-slate-400">
                  표시할 관계 엣지가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. 계층형 카테고리 트리 뷰 */}
      {activeView === 'tree' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-emerald-600" />
                <span>온톨로지 카테고리 계층 구조 (Taxonomy Tree)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                대분류(L1) → 중분류(L2) → 소분류(L3) 체계 및 AI 제안 확장 카테고리
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {categoryTree.map((root) => (
              <CategoryTreeNode key={root.id} item={root} />
            ))}
            {categoryTree.length === 0 && (
              <div className="text-center py-12 text-xs text-slate-400">
                등록된 카테고리가 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. 교차 도메인 브릿지 뷰 */}
      {activeView === 'bridges' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <GitMerge className="w-4 h-4 text-amber-600" />
              <span>4대 도메인 교차 연결 브릿지 (Cross-domain Bridges)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              건강정보, 전통 양생, 일주기리듬, 한의문진 간의 학제간/개념적 융합 연결고리
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bridges.map((bridge, idx) => {
              const srcConfig = DOMAIN_CONFIGS[bridge.sourceDomain];
              const tgtConfig = DOMAIN_CONFIGS[bridge.targetDomain];

              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-indigo-200 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{bridge.concept}</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                      {bridge.relationType}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn('px-2.5 py-1 rounded-md font-semibold', srcConfig.bgLightClass, srcConfig.textClass)}>
                      {srcConfig.shortName}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <span className={cn('px-2.5 py-1 rounded-md font-semibold', tgtConfig.bgLightClass, tgtConfig.textClass)}>
                      {tgtConfig.shortName}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                    <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      융합 메커니즘 근거
                    </div>
                    {bridge.rationale}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Source: {bridge.sourceNodeId}</span>
                    <span>Target: {bridge.targetNodeId}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface CategoryTreeNodeProps {
  item: CategoryItem;
  level?: number;
}

const CategoryTreeNode: React.FC<CategoryTreeNodeProps> = ({ item, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const config = DOMAIN_CONFIGS[item.domain];

  return (
    <div className={cn('space-y-1', level > 0 && 'ml-6 border-l border-slate-200 pl-3')}>
      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-xs">
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 text-slate-400 hover:text-slate-700"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-3.5" />
          )}

          <span className="font-semibold text-slate-800">{item.name}</span>

          {item.description && (
            <span className="text-[11px] text-slate-500 hidden sm:inline">({item.description})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded', config.bgLightClass, config.textClass)}>
            {config.shortName}
          </span>
          <span
            className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase',
              item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            )}
          >
            {item.status}
          </span>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1 mt-1">
          {item.children!.map((child) => (
            <CategoryTreeNode key={child.id} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
