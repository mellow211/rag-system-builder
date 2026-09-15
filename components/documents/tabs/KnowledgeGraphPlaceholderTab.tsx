'use client';

import React from 'react';
import { Network, Sparkles, Share2 } from 'lucide-react';

export const KnowledgeGraphPlaceholderTab: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto shadow-xs">
        <Network className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900">Knowledge Graph & Provenance 서브그래프 (PHASE 4)</h3>
        <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
          승인된 Chunk로부터 Entity와 Relation을 추출하고, 모든 관계의 출처 근거(Document ID, Chunk ID, 신뢰도)를 시각적으로 검토 및 승인하는 화면입니다.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-200 max-w-md mx-auto text-left text-xs space-y-2">
        <span className="font-bold text-violet-900 block">지식 그래프 연결 모델:</span>
        <div className="text-[11px] text-slate-600 space-y-1">
          <div className="p-2 bg-white rounded-lg border border-violet-100 flex items-center justify-between">
            <span className="font-semibold text-slate-800">빛 노출 (Factor)</span>
            <span className="text-violet-600 font-mono text-[10px]">influences ➡️</span>
            <span className="font-semibold text-slate-800">일주기리듬 (Concept)</span>
          </div>
          <div className="text-[10px] text-slate-400 pl-2">
            근거: Chunk #21 (p.23), 신뢰도: 0.91
          </div>
        </div>
      </div>
    </div>
  );
};
