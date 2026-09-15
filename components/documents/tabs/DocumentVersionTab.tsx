'use client';

import React from 'react';
import { RagDocument } from '@/types/rag';
import { GitBranch, Sparkles, Layers, Network, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface DocumentVersionTabProps {
  document: RagDocument;
  dbChunksCount: number;
}

export const DocumentVersionTab: React.FC<DocumentVersionTabProps> = ({ document, dbChunksCount }) => {
  const profileVersion = document.profile_version || 'v1';
  const chunkingVersion = (document.metadata?.chunking_version as string) || 'v2';
  const graphVersion = document.graph_version || 'v1';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-slate-700" />
          3계층 지식 자산 독립 버전 관리 (Triple Asset Provenance)
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          하나의 문서로부터 독립 생성된 Document Profile, RAG Chunk, Knowledge Graph의 상호 버전 및 동기화 상태를 추적합니다.
        </p>
      </div>

      {/* 3개 지식 자산 버전 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Profile Card */}
        <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              1. Document Profile
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900 font-extrabold text-[11px]">
              {profileVersion.toUpperCase()}
            </span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            문서 요약, 주제, 핵심 개념, 대상군 및 카테고리 구조화 인텔리전스
          </p>
          <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>상태: <strong className="text-indigo-800">동기화됨</strong></span>
            <span>{formatDate(document.updated_at)}</span>
          </div>
        </div>

        {/* Chunk Card */}
        <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              2. RAG Chunks
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-extrabold text-[11px]">
              {chunkingVersion.toUpperCase()}
            </span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Structure-aware 청킹 및 Contextualized 1536d pgvector 인덱스 ({dbChunksCount}개 청크)
          </p>
          <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>청킹 전략: <strong className="text-emerald-800">Heading + Context</strong></span>
            <span>{dbChunksCount > 0 ? 'READY' : '대기'}</span>
          </div>
        </div>

        {/* Graph Card */}
        <div className="p-5 rounded-xl border border-violet-200 bg-violet-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-violet-900 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-violet-600" />
              3. Knowledge Graph
            </span>
            <span className="px-2 py-0.5 rounded-full bg-violet-200 text-violet-900 font-extrabold text-[11px]">
              {graphVersion.toUpperCase()}
            </span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Entity, Relation 추출 및 청크 출처(Provenance) 양방향 연결 서브그래프
          </p>
          <div className="pt-2 border-t border-violet-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>근거 보존: <strong className="text-violet-800">Chunk ID 매핑</strong></span>
            <span>출처 추적 가능</span>
          </div>
        </div>
      </div>

      {/* 무결성 및 독립성 보장 안내 배너 */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>지식 출처 보존(Provenance) 및 독립 재시도 원칙</span>
        </div>
        <ul className="text-slate-600 list-disc pl-5 space-y-1 leading-relaxed">
          <li><strong>단계별 독립 재실행</strong>: Document Profile, Chunking, Graph 단계는 독립적으로 실행 및 재시도 가능하며 한 단계의 실패가 타 자산을 파괴하지 않습니다.</li>
          <li><strong>원문 추적 보장</strong>: 모든 Graph 엣지와 노드는 <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">document_id</code>와 <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">chunk_id</code>를 보유하여 건강정보 출처 원문으로 언제든 역추적이 가능합니다.</li>
        </ul>
      </div>
    </div>
  );
};
