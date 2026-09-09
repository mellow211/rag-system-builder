'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SearchResultItem } from '@/types/rag';
import {
  FileText,
  ExternalLink,
  Bookmark,
  Sparkles,
  Building,
  Layers,
  Code2,
  ChevronDown,
  ChevronUp,
  Tag,
  Hash,
  Activity,
  Cpu,
  Search,
  Check,
  Copy,
} from 'lucide-react';

interface SearchResultCardProps {
  result: SearchResultItem;
  rank: number;
  isDebugMode?: boolean;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  rank,
  isDebugMode = false,
}) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(type);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const simPercent = Math.round((result.scores?.final ?? result.similarity) * 100);

  const getBadgeColor = (score: number) => {
    if (score >= 0.85) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 0.7) return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const formatScore = (val: number | null | undefined) => {
    if (val === null || val === undefined) {
      return <span className="text-slate-400 font-mono italic">null</span>;
    }
    return <span className="font-mono font-bold text-slate-800">{val.toFixed(4)}</span>;
  };

  const sectionTitle =
    result.section_title ||
    (result.metadata?.section_title as string) ||
    (result.metadata?.section as string) ||
    null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all overflow-hidden p-5 space-y-3.5">
      {/* 1. 상단 메타 헤더: 순위, 관련도, 문서명, 출처, 페이지 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
            {rank}
          </span>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeColor(
              result.scores?.final ?? result.similarity
            )}`}
          >
            <Sparkles className="w-3 h-3" />
            최종 점수 {(result.scores?.final ?? result.similarity).toFixed(3)} ({simPercent}%)
          </span>

          {result.metadata?.page && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
              <Bookmark className="w-3 h-3 text-slate-500" />
              p.{result.metadata.page}
            </span>
          )}

          {sectionTitle && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-50 text-violet-700 text-xs font-medium border border-violet-100">
              <Tag className="w-3 h-3 text-violet-500" />
              {sectionTitle}
            </span>
          )}

          <span className="text-[11px] text-slate-400 font-mono">
            Chunk #{result.chunk_index}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/documents/${result.document_id}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
          >
            원문 보기
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 2. 문서명 및 출처 정보 */}
      <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="font-bold text-slate-900 truncate">
          {result.document_title || '문서명 없음'}
        </span>
        {(result.document_source || result.metadata?.source) && (
          <>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 truncate flex items-center gap-1">
              <Building className="w-3 h-3 text-slate-400" />
              {(result.document_source || result.metadata?.source) as string}
            </span>
          </>
        )}
      </div>

      {/* 3. [DEBUG 모드] 단계별 검색 Score 및 시스템 메타데이터 그리드 */}
      {isDebugMode && (
        <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs space-y-3 shadow-inner border border-slate-800 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-[11px] uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Retrieval Debug Scores & Identifiers
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Final Rank: #{rank}
            </span>
          </div>

          {/* 4대 스코어 단계별 현황판 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-0.5">
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">1. Vector</div>
              <div className="mt-0.5 text-emerald-400">
                {formatScore(result.scores?.vector)}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                rank #{result.ranks?.vector ?? 1}
              </div>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">2. Keyword</div>
              <div className="mt-0.5 text-amber-400">
                {formatScore(result.scores?.keyword)}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                rank #{result.ranks?.keyword ?? 'null'}
              </div>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">3. Hybrid (RRF)</div>
              <div className="mt-0.5 text-indigo-400">
                {formatScore(result.scores?.hybrid)}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                rank #{result.ranks?.hybrid ?? 'null'}
              </div>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">4. Rerank</div>
              <div className="mt-0.5 text-fuchsia-400">
                {formatScore(result.scores?.rerank)}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                rank #{result.ranks?.rerank ?? 'null'}
              </div>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-lg border border-sky-500/50 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-sky-300 uppercase font-bold">★ Final Score</div>
              <div className="mt-0.5 text-white">
                {formatScore(result.scores?.final ?? result.similarity)}
              </div>
              <div className="text-[9px] text-sky-400 font-mono mt-0.5">
                Final #{rank}
              </div>
            </div>
          </div>

          {/* 식별자 (ID) 상세 정보 */}
          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
            <div className="flex items-center justify-between bg-slate-800/50 px-2.5 py-1.5 rounded">
              <span className="text-slate-400">document_id:</span>
              <div className="flex items-center gap-1.5">
                <span className="truncate max-w-[140px]" title={result.document_id}>
                  {result.document_id}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.document_id, 'doc')}
                  className="hover:text-white p-0.5 text-slate-400"
                >
                  {copiedId === 'doc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-800/50 px-2.5 py-1.5 rounded">
              <span className="text-slate-400">chunk_id:</span>
              <div className="flex items-center gap-1.5">
                <span className="truncate max-w-[140px]" title={result.id}>
                  {result.id}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.id, 'chunk')}
                  className="hover:text-white p-0.5 text-slate-400"
                >
                  {copiedId === 'chunk' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* JSON 원문 토글 */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-[10px] text-slate-400 hover:text-sky-300 flex items-center gap-1"
            >
              <Code2 className="w-3 h-3" />
              <span>전체 청크 메타데이터 JSON {showRawJson ? '접기' : '보기'}</span>
              {showRawJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showRawJson && (
              <pre className="mt-2 p-2.5 bg-slate-950 rounded text-[10px] text-sky-300 overflow-x-auto font-mono">
                {JSON.stringify(
                  {
                    id: result.id,
                    document_id: result.document_id,
                    chunk_index: result.chunk_index,
                    domain: result.domain,
                    section_title: sectionTitle,
                    scores: result.scores,
                    ranks: result.ranks,
                    metadata: result.metadata,
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* 4. Chunk 원문 내용 확인 */}
      <div className="bg-slate-50/90 rounded-lg p-4 border border-slate-200/80 font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
        {result.content}
      </div>
    </div>
  );
};
