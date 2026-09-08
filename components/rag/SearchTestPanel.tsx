'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DomainType, DOMAIN_CONFIGS, SearchResultItem } from '@/types/rag';
import { SearchResultCard } from './SearchResultCard';
import { 
  Search, 
  Sparkles, 
  Filter, 
  SlidersHorizontal, 
  Loader2, 
  AlertCircle, 
  Clock, 
  HelpCircle,
  RotateCcw
} from 'lucide-react';

interface SearchTestPanelProps {
  initialDomain: DomainType;
}

export const SearchTestPanel: React.FC<SearchTestPanelProps> = ({ initialDomain }) => {
  const router = useRouter();
  const [selectedDomain, setSelectedDomain] = useState<DomainType>(initialDomain);
  const [query, setQuery] = useState('고령자의 적절한 수면시간은?');
  const [topK, setTopK] = useState(5);
  const [documentTypeFilter, setDocumentTypeFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 도메인별 추천 질문 목록
  const sampleQueries: Record<DomainType, string[]> = {
    health: [
      '고령자의 적절한 수면시간은?',
      '만 65세 이상 노인의 하루 단백질 권장 섭취량',
      '관절염 환자를 위한 무리 없는 유산소 운동',
    ],
    yangsaeng: [
      '환절기 노인 체온 관리와 섭생 원칙',
      '동의보감에서 권장하는 고령자 식이 양생법',
      '조와조기(早臥早起)의 건강 효능',
    ],
    circadian: [
      '노년기 멜라토닌 분비와 생체시계 조절법',
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
    // URL 동기화
    router.push(`/rag/${domain}/test`);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          query: query.trim(),
          topK,
          filters: {
            documentType: documentTypeFilter,
            source: sourceFilter,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '검색 요청 중 오류가 발생했습니다.');
      }

      setResults(data.results || []);
      setExecutionTime(data.executionTimeMs || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '검색 실패';
      setErrorMessage(msg);
      setResults([]);
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
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
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

        {/* 질문 입력 폼 */}
        <form onSubmit={handleSearch} className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            검증 질문 입력
          </label>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-4" />
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 고령자의 적절한 수면시간은? (자연어 질문)"
              className="w-full pl-11 pr-28 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-xs"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  검색중...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                  검색
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
                onClick={() => {
                  setQuery(q);
                }}
                className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-medium"
              >
                {q}
              </button>
            ))}
          </div>

          {/* 메타데이터 필터 토글 바 */}
          <div className="pt-2 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-semibold"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>메타데이터 필터 및 Top K 설정</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                {showFilters ? '접기' : '펼치기'}
              </span>
            </button>

            {executionTime !== null && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                소요시간: <strong>{executionTime}ms</strong>
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

      {/* 2. 에러 알림 */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 3. 검색 결과 영역 */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>유사도 검색 결과</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                총 {results.length}건 반환
              </span>
            </h2>
            <span className="text-xs text-slate-400">코사인 유사도(Cosine Distance) 순 정렬</span>
          </div>

          {results.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">일치하는 근거 청크가 없습니다.</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                검색 질문을 변경하거나, {currentConfig.shortName}에 관련 지식 자료를 추가로 등록해 보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((item, idx) => (
                <SearchResultCard key={item.id || idx} result={item} rank={idx + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
