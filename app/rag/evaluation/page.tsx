'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DomainType, DOMAIN_CONFIGS } from '@/types/rag';
import { SearchPipelineMode } from '@/services/retrieval/advanced-search';
import { EvaluationMetrics, QuestionEvalResult } from '@/services/evaluation/metrics';
import { BENCHMARK_EVAL_DATASET } from '@/services/evaluation/evaluator';
import {
  ArrowLeft,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
  Clock,
  Target,
  Zap,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

export default function RagEvaluationPage() {
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [selectedMode, setSelectedMode] = useState<SearchPipelineMode>('advanced-v2');
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [questionResults, setQuestionResults] = useState<QuestionEvalResult[] | null>(null);
  const [lastExecutedMode, setLastExecutedMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/rag/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain === 'ALL' ? undefined : selectedDomain,
          mode: selectedMode,
          topK: 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '평가 실행 실패');

      setMetrics(data.metrics);
      setQuestionResults(data.questionResults);
      setLastExecutedMode(selectedMode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '평가 실행 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const domainList: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];

  const modeLabels: Record<SearchPipelineMode, { label: string; desc: string }> = {
    'advanced-v2': {
      label: '⚡ Advanced RAG v2',
      desc: 'Query Rewrite + Hybrid RRF + Diversity Filter + Cross-Scorer Reranking',
    },
    hybrid: {
      label: '하이브리드 (Hybrid RRF)',
      desc: 'Vector Top 30 + Lexical Top 30을 Reciprocal Rank Fusion으로 결합',
    },
    'vector-only': {
      label: 'Vector Only (기존 방식)',
      desc: '단순 pgvector 코사인 유사도 HNSW 검색만 단독 실행',
    },
    'keyword-only': {
      label: 'Keyword Only (키워드 매칭)',
      desc: 'PostgreSQL 한국어 형태소 어근 및 구문 매칭 단독 실행',
    },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 1. 브레드크럼 */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          대시보드로 돌아가기
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200 font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>RAG v2 정량적 성능 벤치마크 평가 시스템</span>
        </div>
      </div>

      {/* 2. 타이틀 배너 */}
      <div className="p-6 rounded-2xl border bg-white shadow-xs border-l-4 border-violet-500 space-y-2">
        <div className="flex items-center gap-2.5">
          <Target className="w-6 h-6 text-violet-600" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            RAG 검색 성능 객관적 지표 평가 (Evaluation)
          </h1>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          기존 단순 <strong>Vector Only</strong> 방식과 새로운 <strong>Advanced RAG v2(하이브리드 + Query Rewrite + Rerank)</strong>의 검색 정확도를 동일한 벤치마크 질의셋에서 객관적 수치(<strong>Hit@1, Hit@3, Hit@5, MRR</strong>)로 비교 검증합니다.
        </p>
      </div>

      {/* 3. 평가 제어 패널 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 도메인 선택 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. 평가 대상 도메인
            </label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-violet-500"
            >
              <option value="ALL">전체 4대 분야 통합 벤치마크 ({BENCHMARK_EVAL_DATASET.length}문항)</option>
              {domainList.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_CONFIGS[d].name} ({BENCHMARK_EVAL_DATASET.filter((q) => q.domain === d).length}문항)
                </option>
              ))}
            </select>
          </div>

          {/* 검색 파이프라인 모드 선택 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              2. 비교 검증할 파이프라인 모드
            </label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as SearchPipelineMode)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-violet-500"
            >
              {(Object.keys(modeLabels) as SearchPipelineMode[]).map((m) => (
                <option key={m} value={m}>
                  {modeLabels[m].label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {modeLabels[selectedMode].desc}
            </p>
          </div>
        </div>

        {/* 실행 버튼 */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400" />
            <span>각 질의별 근거 청크 도출 여부 및 Reciprocal Rank를 자동 채점합니다.</span>
          </div>
          <button
            type="button"
            onClick={handleRunEvaluation}
            disabled={isRunning}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                평가 실행 중...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                [평가 실행하기]
              </>
            )}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* 4. 지표 결과 대시보드 */}
      {metrics && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-600" />
              <span>벤치마크 평가 결과 지표</span>
              <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-xs font-semibold">
                모드: {lastExecutedMode}
              </span>
            </h2>
            <span className="text-xs text-slate-400">총 {metrics.totalQuestions}문항 완료</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold block">Hit@1 (1위 적중률)</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                {Math.round(metrics.hitAt1Rate * 100)}%
              </span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                {metrics.hitAt1Count}/{metrics.totalQuestions} 문항
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold block">Hit@3 (Top 3 적중)</span>
              <span className="text-2xl font-bold text-sky-600 mt-1 block">
                {Math.round(metrics.hitAt3Rate * 100)}%
              </span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                {metrics.hitAt3Count}/{metrics.totalQuestions} 문항
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold block">Hit@5 (Top 5 적중)</span>
              <span className="text-2xl font-bold text-violet-600 mt-1 block">
                {Math.round(metrics.hitAt5Rate * 100)}%
              </span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                {metrics.hitAt5Count}/{metrics.totalQuestions} 문항
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold block">MRR (상호순위 평균)</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
                {metrics.mrr.toFixed(3)}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Mean Reciprocal Rank
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-500 font-semibold block">평균 검색 지연시간</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
                {metrics.avgLatencyMs}ms
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Average Latency
              </span>
            </div>
          </div>

          {/* 문항별 상세 채점 내역 테이블 */}
          {questionResults && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-xs text-slate-800">문항별 상세 평가 결과</h3>
                <span className="text-xs text-slate-400">총 {questionResults.length}건</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold">
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-4">평가 질문</th>
                      <th className="py-2.5 px-4">적중 순위</th>
                      <th className="py-2.5 px-4">Hit@1</th>
                      <th className="py-2.5 px-4">Hit@3</th>
                      <th className="py-2.5 px-4">Hit@5</th>
                      <th className="py-2.5 px-4 font-mono">RR</th>
                      <th className="py-2.5 px-4 font-mono">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questionResults.map((qr, idx) => (
                      <tr key={qr.questionId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 max-w-sm">
                          <div className="font-semibold text-slate-800">{qr.question}</div>
                          {qr.topResultTitle && (
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              1위 결과: {qr.topResultTitle}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {qr.matchedRank !== null ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                              #{qr.matchedRank}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">미적중</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {qr.hitAt1 ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-300" />
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {qr.hitAt3 ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-300" />
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {qr.hitAt5 ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-300" />
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                          {qr.reciprocalRank.toFixed(3)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {qr.latencyMs}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
