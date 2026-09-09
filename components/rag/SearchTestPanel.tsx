'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DomainType, DOMAIN_CONFIGS, SearchResultItem, SearchLatencyBreakdown } from '@/types/rag';
import { SearchResultCard } from './SearchResultCard';
import { SearchPipelineMode } from '@/services/retrieval/advanced-search';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  Clock,
  HelpCircle,
  Terminal,
  Zap,
  Split,
  Layers,
  ArrowRight,
  FileCheck,
} from 'lucide-react';

interface SearchTestPanelProps {
  initialDomain: DomainType;
}

export const SearchTestPanel: React.FC<SearchTestPanelProps> = ({ initialDomain }) => {
  const router = useRouter();
  const [selectedDomain, setSelectedDomain] = useState<DomainType>(initialDomain);
  const [query, setQuery] = useState('고령자가 밤에 자꾸 깨는 원인은?');
  const [topK, setTopK] = useState(5);
  const [documentTypeFilter, setDocumentTypeFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 검색 모드: 'advanced-v2', 'hybrid', 'vector-only', 'keyword-only'
  const [searchMode, setSearchMode] = useState<SearchPipelineMode>('advanced-v2');
  // Side-by-Side 비교 모드 활성화 여부
  const [isCompareMode, setIsCompareMode] = useState(false);
  // Debug 상세 정보 표시 토글
  const [isDebugMode, setIsDebugMode] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [vectorCompareResults, setVectorCompareResults] = useState<SearchResultItem[] | null>(null);
  const [rewrittenQueryInfo, setRewrittenQueryInfo] = useState<{
    original: string;
    rewritten: string;
    isRewritten: boolean;
  } | null>(null);

  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [latencyBreakdown, setLatencyBreakdown] = useState<SearchLatencyBreakdown | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 도메인별 추천 질문 목록
  const sampleQueries: Record<DomainType, string[]> = {
    health: [
      '고령자의 적절한 수면시간은?',
      '만 65세 이상 노인의 하루 단백질 권장 섭취량',
      '관절염 환자를 위한 무리 없는 유산소 운동',
    ],
    yangsaeng: [
      '동의보감에서 권장하는 고령자 식이 양생법',
      '환절기 노인 체온 관리와 섭생 원칙',
      '조와조기(早臥早起)의 건강 효능',
    ],
    circadian: [
      '고령자가 밤에 자꾸 깨는 원인은?',
      '수면 위생을 위한 아침 햇볕 노출 가이드라인',
      '낮잠 시간과 야간 수면 질의 상관관계',
    ],
    'korean-medicine': [
      '고령자 기혈허약(氣血虛弱) 변증과 문진 지표',
      '소음인 노인의 소화기능 저하 시 대처법',
      '한의학적 어지럼증 문진 질문 항목',
    ],
  };

  const handleDomainChange = (domain: DomainType) => {
    setSelectedDomain(domain);
    router.push(`/rag/${domain}/test`);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setVectorCompareResults(null);

    try {
      if (isCompareMode) {
        // [비교 모드]: Advanced RAG v2와 Vector Only를 동시에 병렬 호출
        const [advRes, vecRes] = await Promise.all([
          fetch('/api/rag/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domain: selectedDomain,
              query: query.trim(),
              topK,
              mode: 'advanced-v2',
              filters: {
                documentType: documentTypeFilter,
                source: sourceFilter,
              },
            }),
          }),
          fetch('/api/rag/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domain: selectedDomain,
              query: query.trim(),
              topK,
              mode: 'vector-only',
              filters: {
                documentType: documentTypeFilter,
                source: sourceFilter,
              },
            }),
          }),
        ]);

        const advData = await advRes.json();
        const vecData = await vecRes.json();

        if (!advRes.ok) throw new Error(advData.error || 'Advanced RAG 검색 실패');
        if (!vecRes.ok) throw new Error(vecData.error || 'Vector 검색 실패');

        setResults(advData.results || []);
        setVectorCompareResults(vecData.results || []);
        setRewrittenQueryInfo(advData.query || null);
        setExecutionTime(advData.executionTimeMs || 0);
        setLatencyBreakdown(advData.latencyBreakdown || null);
        setDebugInfo(advData.debugInfo || null);
      } else {
        // [단일 모드]: 선택된 모드로 검색
        const res = await fetch('/api/rag/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: selectedDomain,
            query: query.trim(),
            topK,
            mode: searchMode,
            filters: {
              documentType: documentTypeFilter,
              source: sourceFilter,
            },
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '검색 요청 실패');

        setResults(data.results || []);
        setRewrittenQueryInfo(data.query || null);
        setExecutionTime(data.executionTimeMs || 0);
        setLatencyBreakdown(data.latencyBreakdown || null);
        setDebugInfo(data.debugInfo || null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '검색 실패';
      setErrorMessage(msg);
      setResults([]);
      setVectorCompareResults(null);
      setLatencyBreakdown(null);
      setDebugInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const domainList: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];
  const currentConfig = DOMAIN_CONFIGS[selectedDomain];

  return (
    <div className="space-y-6">
      {/* 1. 검색 제어 메인 카드 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        {/* RAG 도메인 선택 탭 */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            검색 대상 RAG 지식베이스 선택
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {domainList.map((d) => {
              const conf = DOMAIN_CONFIGS[d];
              const isSelected = d === selectedDomain;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDomainChange(d)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border cursor-pointer ${
                    isSelected
                      ? `${conf.bgLightClass} ${conf.textClass} ${conf.borderClass} shadow-xs ring-1 ring-slate-900/10`
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: conf.primaryHex }}
                    />
                    {conf.shortName}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold">
                      선택됨
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* RAG 검색 전략 모드 선택 & Side-by-Side 비교 토글 바 */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-600 mr-1">검색 파이프라인:</span>
            <button
              type="button"
              disabled={isCompareMode}
              onClick={() => setSearchMode('advanced-v2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'advanced-v2' && !isCompareMode
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40'
              }`}
            >
              ⚡ Advanced RAG v2 (추천)
            </button>
            <button
              type="button"
              disabled={isCompareMode}
              onClick={() => setSearchMode('hybrid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                searchMode === 'hybrid' && !isCompareMode
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40'
              }`}
            >
              하이브리드 (RRF)
            </button>
            <button
              type="button"
              disabled={isCompareMode}
              onClick={() => setSearchMode('vector-only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                searchMode === 'vector-only' && !isCompareMode
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40'
              }`}
            >
              Vector Only
            </button>
            <button
              type="button"
              disabled={isCompareMode}
              onClick={() => setSearchMode('keyword-only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                searchMode === 'keyword-only' && !isCompareMode
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40'
              }`}
            >
              Keyword Only
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Side-by-Side 비교 모드 토글 */}
            <button
              type="button"
              onClick={() => setIsCompareMode(!isCompareMode)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                isCompareMode
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>기존 Vector vs RAG v2 비교: {isCompareMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* Debug 모드 토글 */}
            <button
              type="button"
              onClick={() => setIsDebugMode(!isDebugMode)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                isDebugMode
                  ? 'bg-slate-900 text-sky-300 border-slate-800 shadow-xs'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Debug: {isDebugMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* 질문 입력 폼 */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-4" />
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 고령자가 밤에 자꾸 깨는 원인은? (자연어 질문)"
              className="w-full pl-11 pr-28 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-xs"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  검색중...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                  {isCompareMode ? '비교 검색' : '검색'}
                </>
              )}
            </button>
          </div>

          {/* 추천 질문 칩 */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> 추천 질문:
            </span>
            {sampleQueries[selectedDomain].map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(q)}
                className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-medium cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* 필터 설정 토글 바 */}
          <div className="pt-2 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>메타데이터 필터 및 Top K 설정</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                {showFilters ? '접기' : '펼치기'}
              </span>
            </button>

            {executionTime !== null && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Total Latency:</span>
                <strong className="text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                  {executionTime}ms
                </strong>
              </span>
            )}
          </div>

          {/* 접이식 필터 패널 */}
          {showFilters && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Top K (반환 청크 수)
                </label>
                <select
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium"
                >
                  <option value={3}>Top 3</option>
                  <option value={5}>Top 5 (기본)</option>
                  <option value={10}>Top 10</option>
                  <option value={20}>Top 20</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  자료유형 필터
                </label>
                <select
                  value={documentTypeFilter}
                  onChange={(e) => setDocumentTypeFilter(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="ALL">전체 자료</option>
                  <option value="가이드라인">가이드라인</option>
                  <option value="논문">논문</option>
                  <option value="공공기관 자료">공공기관 자료</option>
                  <option value="내부 문서">내부 문서</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  출처/발행기관
                </label>
                <input
                  type="text"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  placeholder="예: 질병관리청"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Query Rewrite 배너 (질의 정규화 및 재작성이 수행된 경우) */}
      {rewrittenQueryInfo?.isRewritten && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px] uppercase">
              Query Rewrite 적용됨
            </span>
            <span className="text-slate-500">원문 질의:</span>
            <span className="font-semibold line-through text-slate-600">{rewrittenQueryInfo.original}</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-slate-500">검색 최적화 질의:</span>
            <strong className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
              {rewrittenQueryInfo.rewritten}
            </strong>
          </div>
        </div>
      )}

      {/* [DEBUG] Latency 계측 바 */}
      {isDebugMode && (latencyBreakdown || debugInfo) && (
        <div className="p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
            <span className="font-bold text-sky-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Advanced RAG v2 Latency & Architecture
            </span>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span>Mode: <strong className="text-slate-200">{searchMode}</strong></span>
              <span>•</span>
              <span>RRF K: <strong className="text-slate-200">60</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">1. Rewrite</span>
              <span className="text-sm font-mono font-bold text-indigo-400 mt-0.5 block">
                {latencyBreakdown?.queryRewriteMs !== undefined ? `${latencyBreakdown.queryRewriteMs}ms` : '-'}
              </span>
              <span className="text-[9px] text-slate-500">질의 정규화</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">2. Vector</span>
              <span className="text-sm font-mono font-bold text-sky-400 mt-0.5 block">
                {latencyBreakdown?.vectorSearchMs !== undefined ? `${latencyBreakdown.vectorSearchMs}ms` : '-'}
              </span>
              <span className="text-[9px] text-slate-500">pgvector HNSW</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">3. Keyword</span>
              <span className="text-sm font-mono font-bold text-amber-400 mt-0.5 block">
                {latencyBreakdown?.keywordSearchMs !== undefined ? `${latencyBreakdown.keywordSearchMs}ms` : '-'}
              </span>
              <span className="text-[9px] text-slate-500">Postgres Lexical</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">4. RRF Fusion</span>
              <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
                {latencyBreakdown?.fusionMs !== undefined ? `${latencyBreakdown.fusionMs}ms` : '-'}
              </span>
              <span className="text-[9px] text-slate-500">상위 20개 통합</span>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">5. Rerank</span>
              <span className="text-sm font-mono font-bold text-fuchsia-400 mt-0.5 block">
                {latencyBreakdown?.rerankMs !== undefined ? `${latencyBreakdown.rerankMs}ms` : '-'}
              </span>
              <span className="text-[9px] text-slate-500">다양성 및 재정렬</span>
            </div>

            <div className="bg-slate-800 p-2.5 rounded-lg border border-sky-500/40 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-sky-300 block font-bold">★ Total</span>
              <span className="text-base font-mono font-bold text-white mt-0.5 block">
                {latencyBreakdown?.totalMs ?? executionTime ?? 0}ms
              </span>
              <span className="text-[9px] text-sky-400">전체 소요시간</span>
            </div>
          </div>
        </div>
      )}

      {/* 에러 알림 */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. 검색 결과 영역 (Side-by-Side 비교 또는 단일 뷰어) */}
      {results && (
        <div className="space-y-4">
          {isCompareMode && vectorCompareResults ? (
            /* [비교 뷰]: 좌측 Vector Only vs 우측 Advanced RAG v2 */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 좌측: Vector Only (기존 방식) */}
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-600 text-white font-bold text-xs">
                      기존 방식
                    </span>
                    <h3 className="font-bold text-xs text-slate-800">단순 Vector Search</h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {vectorCompareResults.length}건 반환
                  </span>
                </div>

                {vectorCompareResults.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                    일치하는 결과가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vectorCompareResults.map((item, idx) => (
                      <SearchResultCard
                        key={`vec-${item.id || idx}`}
                        result={item}
                        rank={idx + 1}
                        isDebugMode={isDebugMode}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 우측: Advanced RAG v2 (신규 파이프라인) */}
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-violet-100 border border-violet-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-violet-600 text-white font-bold text-xs">
                      RAG v2
                    </span>
                    <h3 className="font-bold text-xs text-violet-900">
                      Hybrid + Rewrite + Diversity + Rerank
                    </h3>
                  </div>
                  <span className="text-[11px] text-violet-700 font-mono">
                    {results.length}건 반환
                  </span>
                </div>

                {results.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                    일치하는 결과가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {results.map((item, idx) => (
                      <SearchResultCard
                        key={`adv-${item.id || idx}`}
                        result={item}
                        rank={idx + 1}
                        isDebugMode={isDebugMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* [단일 뷰] */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>검색 결과</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    총 {results.length}건 반환
                  </span>
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>모드: {searchMode}</span>
                  <span>•</span>
                  <span>{isDebugMode ? 'Debug 모드' : '일반 모드'}</span>
                </div>
              </div>

              {results.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-700">
                    일치하는 근거 청크가 없습니다.
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    검색 질문을 변경하거나 관련 지식 자료를 추가로 등록해 보세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((item, idx) => (
                    <SearchResultCard
                      key={item.id || idx}
                      result={item}
                      rank={idx + 1}
                      isDebugMode={isDebugMode}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
