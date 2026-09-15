'use client';

import React from 'react';
import { Layers, Sparkles, ArrowRight, Bot } from 'lucide-react';

interface ChunkAgentPlaceholderTabProps {
  onSwitchToRagIndex: () => void;
}

export const ChunkAgentPlaceholderTab: React.FC<ChunkAgentPlaceholderTabProps> = ({ onSwitchToRagIndex }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
        <Bot className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900">Agent-assisted Chunking 설계 (PHASE 2)</h3>
        <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
          좌측의 실시간 문서 구조 트리와 우측의 청킹 대화 에이전트(Chunking Agent)를 통해 사용자가 청크 분할, 병합, 카테고리 지정 도구를 대화형으로 실행하는 화면입니다.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-left text-xs space-y-2">
        <span className="font-bold text-slate-700 block">지원 예정 Chunking Agent Tools:</span>
        <ul className="text-slate-600 space-y-1 list-disc pl-4 text-[11px]">
          <li><code className="text-blue-600 font-mono">analyzeDocumentStructure()</code>: 문서 섹션 깊이 탐색</li>
          <li><code className="text-blue-600 font-mono">splitSection()</code>: 대용량 섹션 세부 분할</li>
          <li><code className="text-blue-600 font-mono">mergeChunks()</code>: 유사 토픽 청크 병합</li>
          <li><code className="text-blue-600 font-mono">applyChunkPlan()</code>: 사용자 최종 승인 적용</li>
        </ul>
      </div>

      <div className="pt-2">
        <button
          onClick={onSwitchToRagIndex}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
        >
          <span>현재 생성된 RAG Index 확인하기</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
