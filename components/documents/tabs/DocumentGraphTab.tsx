'use client';

import React, { useState, useEffect } from 'react';
import { KnowledgeNode, KnowledgeEdge, DomainType } from '@/types/rag';
import {
  Network,
  Sparkles,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  Tag,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface DocumentGraphTabProps {
  documentId: string;
  domain: DomainType;
}

export const DocumentGraphTab: React.FC<DocumentGraphTabProps> = ({ documentId, domain }) => {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadGraph = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/graph`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '그래프 로드 실패');

      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : '그래프 로드 오류',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [documentId]);

  const handleExtract = async () => {
    setIsExtracting(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/graph/extract`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '그래프 추출 실패');

      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setNotice({
        type: 'success',
        message: `✨ ${data.nodes.length}개 Entity 및 ${data.edges.length}개 Relation 추출 완료!`,
      });
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : '그래프 추출 오류',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleEdgeAction = async (edgeId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/documents/${documentId}/graph/edges/${edgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setEdges((prev) => prev.map((e) => (e.id === edgeId ? { ...e, status } : e)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-violet-600 animate-spin mx-auto" />
        <h3 className="text-base font-bold text-slate-800">지식 그래프 및 Provenance 조회 중...</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. 상단 액션 바 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Knowledge Fabric Subgraph</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-violet-100 text-violet-800 border border-violet-200">
              Entity {nodes.length}개 / Relation {edges.length}개
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Network className="w-5 h-5 text-violet-600" />
            지식 그래프 (Knowledge Graph) 및 출처 근거 (Provenance)
          </h2>
        </div>

        <button
          onClick={handleExtract}
          disabled={isExtracting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isExtracting ? 'animate-spin' : ''}`} />
          {isExtracting ? 'AI 지식 그래프 추출 중...' : 'AI 지식 그래프 재추출'}
        </button>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 shadow-xs ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{notice.message}</span>
        </div>
      )}

      {/* 2. 엔티티 노드 목록 (Entity Nodes) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-violet-600" />
            추출된 핵심 엔티티 노드 (Entity Nodes - {nodes.length}개)
          </h3>
          <span className="text-[11px] text-slate-400">표준어(Canonical) 정규화 적용됨</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="px-3 py-1.5 rounded-xl border border-violet-200 bg-violet-50/60 text-xs flex items-center gap-2"
            >
              <span className="font-bold text-violet-900">{node.canonical_name}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white text-violet-700 border border-violet-200">
                {node.node_type}
              </span>
              {node.aliases && node.aliases.length > 0 && (
                <span className="text-[10px] text-slate-400" title={`별칭: ${node.aliases.join(', ')}`}>
                  (+{node.aliases.length})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. 관계 목록 및 출처 근거 (Relations & Provenance) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            지식 관계 및 출처 근거 (Knowledge Relations with Provenance - {edges.length}개)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            모든 관계는 어느 청크에서 추출되었는지 원문과 신뢰도 점수를 보존하며, 검토 후 확정할 수 있습니다.
          </p>
        </div>

        <div className="space-y-3">
          {edges.map((edge) => {
            const isApproved = edge.status === 'APPROVED';
            const isRejected = edge.status === 'REJECTED';

            return (
              <div
                key={edge.id}
                className={`p-4 rounded-xl border transition-all text-xs space-y-3 ${
                  isApproved
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : isRejected
                    ? 'bg-slate-100 border-slate-200 opacity-60'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                {/* 엣지 헤더: Source -> Relation -> Target */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap font-bold">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 shadow-2xs">
                      {edge.source_node?.canonical_name || '개념 A'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono text-violet-700 bg-violet-100 font-extrabold">
                      ── {edge.relation_type} ──▶
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 shadow-2xs">
                      {edge.target_node?.canonical_name || '개념 B'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-200 text-slate-700">
                      신뢰도 {(edge.confidence * 100).toFixed(0)}%
                    </span>

                    <button
                      onClick={() => handleEdgeAction(edge.id, 'APPROVED')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                        isApproved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isApproved ? '✓ 승인됨' : '승인'}
                    </button>

                    <button
                      onClick={() => handleEdgeAction(edge.id, 'REJECTED')}
                      className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                        isRejected
                          ? 'bg-rose-600 text-white'
                          : 'bg-white hover:bg-rose-50 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {isRejected ? '반려됨' : '반려'}
                    </button>
                  </div>
                </div>

                {/* 출처 원문 근거 (Evidence Provenance) */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-slate-600">
                      <FileText className="w-3 h-3 text-slate-500" />
                      근거 원문 (Provenance: Chunk #{String(edge.metadata?.chunk_index ?? 1)}, p.{String(edge.metadata?.page ?? edge.page ?? 1)})
                    </span>
                    <span className="font-mono text-[10px]">{edge.chunk_id?.slice(0, 12)}...</span>
                  </div>
                  <p className="text-[11px] text-slate-700 italic leading-relaxed">
                    &ldquo;{edge.evidence_text || '본문에서 추출된 문장'}&rdquo;
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
