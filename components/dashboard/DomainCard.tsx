import React from 'react';
import Link from 'next/link';
import { DomainStats, DOMAIN_CONFIGS } from '@/types/rag';
import { formatDate } from '@/lib/utils';
import { FileText, Layers, Clock, ArrowRight, PlusCircle, Search } from 'lucide-react';

interface DomainCardProps {
  stats: DomainStats;
}

export const DomainCard: React.FC<DomainCardProps> = ({ stats }) => {
  const config = DOMAIN_CONFIGS[stats.domain];

  // 도메인별 스타일 매핑
  const colorMap = {
    blue: {
      borderHover: 'hover:border-blue-300',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      accentDot: 'bg-blue-600',
      iconBg: 'bg-blue-50 text-blue-600',
      linkHover: 'hover:text-blue-600',
      headerBorder: 'border-l-blue-600',
    },
    green: {
      borderHover: 'hover:border-emerald-300',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentDot: 'bg-emerald-600',
      iconBg: 'bg-emerald-50 text-emerald-600',
      linkHover: 'hover:text-emerald-600',
      headerBorder: 'border-l-emerald-600',
    },
    orange: {
      borderHover: 'hover:border-orange-300',
      badge: 'bg-orange-50 text-orange-700 border-orange-200',
      accentDot: 'bg-orange-600',
      iconBg: 'bg-orange-50 text-orange-600',
      linkHover: 'hover:text-orange-600',
      headerBorder: 'border-l-orange-600',
    },
    purple: {
      borderHover: 'hover:border-purple-300',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      accentDot: 'bg-purple-600',
      iconBg: 'bg-purple-50 text-purple-600',
      linkHover: 'hover:text-purple-600',
      headerBorder: 'border-l-purple-600',
    },
  };

  const style = colorMap[config.themeColor];

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between transition-all duration-200 ${style.borderHover} hover:shadow-sm border-l-4 ${style.headerBorder}`}
    >
      <div>
        {/* 카드 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${style.accentDot}`} />
              <h3 className="font-bold text-slate-900 text-base">{config.name}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 pr-2">
              {config.description}
            </p>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${style.badge}`}>
            {config.shortName}
          </span>
        </div>

        {/* 핵심 메트릭스: 문서 수, Chunk 수, 최근 업데이트 */}
        <div className="grid grid-cols-2 gap-3 py-3 my-2 border-y border-slate-100">
          <div className="bg-slate-50/80 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <FileText className="w-3.5 h-3.5" />
              <span>문서 수</span>
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {stats.documentCount.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 ml-1">건</span>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Chunk 수</span>
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {stats.chunkCount.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 ml-1">개</span>
            </div>
          </div>
        </div>

        {/* 최근 업데이트 일시 */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 my-2">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            최근 업데이트: <strong className="font-medium text-slate-700">{formatDate(stats.lastUpdated)}</strong>
          </span>
        </div>
      </div>

      {/* 액션 버튼 영역 */}
      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <Link
          href={`/rag/${stats.domain}/test`}
          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Search className="w-3 h-3 text-slate-500" />
          검색 검증
        </Link>

        <Link
          href={`/rag/${stats.domain}`}
          className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs`}
        >
          자료 관리
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
