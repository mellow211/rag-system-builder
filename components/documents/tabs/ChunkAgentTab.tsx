'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChunkProposal, ChunkingSession } from '@/types/rag';
import { DocumentSectionNode, ChunkPlanSummary } from '@/services/chunking-agent/types';
import {
  Layers,
  Bot,
  User,
  Send,
  Sparkles,
  Split,
  Merge,
  Edit3,
  CheckCircle2,
  FolderTree,
  FileText,
  Loader2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Hash,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';

interface ChunkAgentTabProps {
  documentId: string;
  onApplySuccess?: () => void;
}

export const ChunkAgentTab: React.FC<ChunkAgentTabProps> = ({ documentId, onApplySuccess }) => {
  const [session, setSession] = useState<ChunkingSession | null>(null);
  const [proposals, setProposals] = useState<ChunkProposal[]>([]);
  const [structure, setStructure] = useState<DocumentSectionNode[]>([]);
  const [summary, setSummary] = useState<ChunkPlanSummary | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 선택된 섹션 필터
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  // 선택된 청크 ID (단일 뷰)
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  // 병합 선택 모드
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);
  const [isMergeMode, setIsMergeMode] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // 세션 데이터 로드
  const loadSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/chunk-agent/session`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '세션 로드 실패');

      setSession(data.session);
      setProposals(data.proposals || []);
      setStructure(data.structure || []);
      setSummary(data.summary || null);
      if (data.proposals?.length > 0 && !selectedProposalId) {
        setSelectedProposalId(data.proposals[0].id);
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : '세션 초기화 오류',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [documentId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.chat_history]);

  // 대화 전송
  const handleSendMessage = async (customMsg?: string) => {
    const textToSend = customMsg || inputMessage;
    if (!textToSend.trim() || isSending) return;

    setIsSending(true);
    setNotice(null);
    setInputMessage('');

    try {
      const res = await fetch(`/api/documents/${documentId}/chunk-agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '대화 실패');

      setSession(data.session);
      setProposals(data.proposals);
      setStructure(data.structure);
      setSummary(data.summary);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : '메시지 전송 오류',
      });
    } finally {
      setIsSending(false);
    }
  };

  // 단일 청크 승인
  const handleApproveProposal = async (proposalId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/chunk-agent/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      const data = await res.json();
      if (data.success) {
        setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: 'APPROVED' } : p)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 단일 청크 카테고리 빠른 변경
  const handleQuickCategoryChange = async (proposalId: string, newCategory: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/chunk-agent/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory, status: 'EDITED' }),
      });
      const data = await res.json();
      if (data.success) {
        setProposals((prev) =>
          prev.map((p) => (p.id === proposalId ? { ...p, category: newCategory, status: 'EDITED' } : p))
        );
        setNotice({ type: 'success', message: `청크 카테고리가 '${newCategory}'(으)로 변경되었습니다.` });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 단일 청크 제목 빠른 변경
  const handleQuickRename = async (proposalId: string, currentTitle: string) => {
    const newTitle = prompt('수정할 청크 제목을 입력하세요:', currentTitle);
    if (!newTitle || newTitle.trim() === currentTitle) return;

    try {
      const res = await fetch(`/api/documents/${documentId}/chunk-agent/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), status: 'EDITED' }),
      });
      const data = await res.json();
      if (data.success) {
        setProposals((prev) =>
          prev.map((p) => (p.id === proposalId ? { ...p, title: newTitle.trim(), status: 'EDITED' } : p))
        );
        setNotice({ type: 'success', message: `청크 제목이 '${newTitle.trim()}'(으)로 변경되었습니다.` });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 청크 분할 도구 실행
  const handleSplit = async (proposalId: string) => {
    const subTitle1 = prompt('분할할 첫 번째 파트 제목:', '세부 주제 A');
    if (!subTitle1) return;
    const subTitle2 = prompt('분할할 두 번째 파트 제목:', '세부 주제 B');
    if (!subTitle2) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/chunk-agent/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'splitSection',
          params: { proposalId, subTitles: [subTitle1, subTitle2] },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분할 실패');

      setProposals(data.proposals);
      setSummary(data.summary);
      setNotice({ type: 'success', message: '청크가 성공적으로 2개로 분할되었습니다.' });
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : '분할 오류' });
    } finally {
      setIsSending(false);
    }
  };

  // 청크 병합 도구 실행
  const handleMergeSubmit = async () => {
    if (mergeSelectedIds.length < 2) {
      alert('병합하려면 2개 이상의 청크를 선택하세요.');
      return;
    }
    const newTitle = prompt('병합된 청크의 새 제목을 입력하세요:', '통합 섹션');
    if (!newTitle) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/chunk-agent/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'mergeChunks',
          params: { proposalIds: mergeSelectedIds, newTitle },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '병합 실패');

      setProposals(data.proposals);
      setSummary(data.summary);
      setMergeSelectedIds([]);
      setIsMergeMode(false);
      setNotice({ type: 'success', message: '선택한 청크들이 성공적으로 병합되었습니다.' });
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : '병합 오류' });
    } finally {
      setIsSending(false);
    }
  };

  // 최종 Chunk Plan 승인 및 RAG 인덱스 적용 (PHASE 3 연계)
  const handleApplyPlan = async () => {
    if (!confirm(`총 ${proposals.length}개의 청크 설계를 최종 확정하고 RAG Vector Index를 구축하시겠습니까?`)) return;

    setIsApplying(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/chunk-agent/apply`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '인덱스 생성 실패');

      setNotice({
        type: 'success',
        message: `🎉 ${data.chunksCount}개 청크의 RAG 인덱스가 성공적으로 구축되었습니다! RAG Index 탭으로 이동합니다.`,
      });
      if (onApplySuccess) onApplySuccess();
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : '최종 적용 오류',
      });
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        <h3 className="text-base font-bold text-slate-800">문서 구조 분석 및 에이전트 세션 준비 중...</h3>
        <p className="text-xs text-slate-500">지능적 섹션 분할 계획을 생성하고 있습니다.</p>
      </div>
    );
  }

  const filteredProposals = selectedSection
    ? proposals.filter((p) => p.section_path?.[0] === selectedSection)
    : proposals;

  return (
    <div className="space-y-6">
      {/* 1. 상단 현황 배너 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agent-assisted Chunking</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
              ⚡ 계획 수립 단계 (Plan)
            </span>
            <span className="text-xs text-slate-500">
              총 <strong>{proposals.length}개</strong> 제안됨 (평균 {summary?.avgTokens || 0} tok)
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            AI와 Chunk 설계 (Agent 대화 및 청크 구조화)
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsMergeMode(!isMergeMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
              isMergeMode
                ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/30'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Merge className="w-3.5 h-3.5 text-amber-600" />
            {isMergeMode ? `병합 선택 중 (${mergeSelectedIds.length}개)` : '청크 병합 모드'}
          </button>

          {isMergeMode && mergeSelectedIds.length >= 2 && (
            <button
              onClick={handleMergeSubmit}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
            >
              선택한 {mergeSelectedIds.length}개 병합 실행
            </button>
          )}

          <button
            onClick={handleApplyPlan}
            disabled={isApplying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs hover:shadow cursor-pointer disabled:opacity-50"
          >
            {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            최종 Chunk 승인 및 RAG Index 생성
          </button>
        </div>
      </div>

      {/* 알림 메시지 */}
      {notice && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 transition-all shadow-xs ${
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

      {/* 2. 메인 2단 분할 레이아웃 (좌측: 문서 구조 Tree, 우측: Agent Chat & Proposals Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌측 (4열): 문서 구조 Tree */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 h-[750px] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              문서 구조 Tree
            </h3>
            {selectedSection && (
              <button
                onClick={() => setSelectedSection(null)}
                className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
              >
                전체보기
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            {structure.map((sec, idx) => {
              const isSecSelected = selectedSection === sec.title;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedSection(isSecSelected ? null : sec.title)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSecSelected
                      ? 'bg-indigo-50 border-indigo-300 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200/70 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-800 line-clamp-1">{sec.title}</span>
                    <span className="px-1.5 py-0.2 rounded bg-white text-slate-600 text-[10px] font-mono shrink-0 border border-slate-200">
                      {sec.childCount}개 청크
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 font-mono">
                    <span>p.{sec.pageStart}~{sec.pageEnd}</span>
                    <span>{sec.tokenCount.toLocaleString()} tok</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
            💡 섹션을 클릭하면 해당 섹션의 Chunk만 필터링하여 프리뷰할 수 있습니다.
          </div>
        </div>

        {/* 우측 (8열): Agent 대화 및 Chunk Preview */}
        <div className="lg:col-span-8 space-y-6">
          {/* Agent Chat 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[380px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Chunking Agent</div>
                  <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    대화형 청크 조정 준비됨
                  </div>
                </div>
              </div>

              {/* 빠른 질문/지시 칩 */}
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => handleSendMessage('가장 긴 청크 분할해줘')}
                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  ✂️ 긴 청크 분할
                </button>
                <button
                  onClick={() => handleSendMessage('1번과 2번 청크 합쳐줘')}
                  className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  🔗 청크 병합
                </button>
                <button
                  onClick={() => handleSendMessage('이대로 승인해줘')}
                  className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-bold hover:bg-emerald-100"
                >
                  ✅ 전체 승인
                </button>
              </div>
            </div>

            {/* 대화 히스토리 */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {(session?.chat_history || []).map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 max-w-[85%] ${
                    msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line shadow-2xs ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white rounded-tr-none'
                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex gap-2 max-w-[80%]">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <div className="p-3 bg-slate-100 text-slate-500 rounded-2xl rounded-tl-none text-xs flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    청크 구조를 분석하고 조정하는 중...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 입력창 */}
            <div className="p-3 border-t border-slate-100 flex items-center gap-2 bg-white rounded-b-2xl">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Agent에게 지시하세요 (예: '빛 노출과 멜라토닌 묶어줘', '전체 승인해줘')..."
                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isSending || !inputMessage.trim()}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chunk Proposals 프리뷰 목록 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  청크 제안 프리뷰 (Chunk Proposals Preview - {filteredProposals.length}개)
                </h3>
                <p className="text-[11px] text-slate-500">
                  승인 전 각 청크를 열람하고 [분리], [병합], [승인]할 수 있습니다.
                </p>
              </div>

              {isMergeMode && (
                <div className="text-xs text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  병합할 청크의 체크박스를 선택하세요
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredProposals.map((p) => {
                const isApproved = p.status === 'APPROVED';
                const isSelectedForMerge = mergeSelectedIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
                      isSelectedForMerge
                        ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                        : isApproved
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isMergeMode && (
                          <input
                            type="checkbox"
                            checked={isSelectedForMerge}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMergeSelectedIds([...mergeSelectedIds, p.id]);
                              } else {
                                setMergeSelectedIds(mergeSelectedIds.filter((id) => id !== p.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-amber-600 cursor-pointer"
                          />
                        )}
                        <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-mono font-bold text-[11px]">
                          #{p.proposed_index}
                        </span>
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          {p.title}
                          <button
                            onClick={() => handleQuickRename(p.id, p.title)}
                            title="제목 수정"
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </span>

                        <div className="flex items-center gap-1">
                          <select
                            value={p.category || '기본'}
                            onChange={(e) => handleQuickCategoryChange(p.id, e.target.value)}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 cursor-pointer hover:border-blue-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                            title="카테고리 직접 변경"
                          >
                            <option value="초록">초록</option>
                            <option value="서론">서론</option>
                            <option value="연구방법">연구방법</option>
                            <option value="연구결과">연구결과</option>
                            <option value="고찰">고찰</option>
                            <option value="결론">결론</option>
                            <option value="참고문헌">참고문헌</option>
                            <option value="임상양생">임상양생</option>
                            <option value="기본">기본</option>
                          </select>

                          {p.status === 'EDITED' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              수정됨
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-700 font-bold">
                          {p.token_count || 0} tok
                        </span>
                        <span className="text-[11px] text-slate-400">p.{p.page_start || 1}</span>

                        <button
                          onClick={() => handleSplit(p.id)}
                          title="이 청크 분할하기"
                          className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                        >
                          <Split className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleApproveProposal(p.id)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-white hover:bg-emerald-50 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isApproved ? '✓ 승인됨' : '승인'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-700 line-clamp-2 leading-relaxed pl-8 font-sans">
                      {p.proposed_content}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
