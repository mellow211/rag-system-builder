import React from 'react';
import Link from 'next/link';
import { SearchResultItem } from '@/types/rag';
import { FileText, ExternalLink, Bookmark, Sparkles, Building, Layers } from 'lucide-react';

interface SearchResultCardProps {
  result: SearchResultItem;
  rank: number;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ result, rank }) => {
  // 유사도 백분율 및 게이지 색상
  const simPercent = Math.round(result.similarity * 100);
  const getBadgeColor = (score: number) => {
    if (score >= 0.85) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 0.7) return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

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
              result.similarity
            )}`}
          >
            <Sparkles className="w-3 h-3" />
            관련도 {result.similarity.toFixed(3)} ({simPercent}%)
          </span>

          {result.metadata?.page && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
              <Bookmark className="w-3 h-3 text-slate-500" />
              p.{result.metadata.page}
            </span>
          )}

          <span className="text-[11px] text-slate-400 font-mono">
            Chunk #{result.chunk_index}
          </span>
        </div>

        <div className="text-right">
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
      <div className="flex items-center gap-2 text-xs text-slate-600">
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

      {/* 3. Chunk 원문 내용 확인 */}
      <div className="bg-slate-50/90 rounded-lg p-4 border border-slate-200/80 font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
        {result.content}
      </div>
    </div>
  );
};
