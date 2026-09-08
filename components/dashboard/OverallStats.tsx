import React from 'react';
import { OverallStats as OverallStatsType } from '@/types/rag';
import { FileText, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

interface OverallStatsProps {
  stats: OverallStatsType;
}

export const OverallStats: React.FC<OverallStatsProps> = ({ stats }) => {
  const statCards = [
    {
      title: '전체 문서',
      value: stats.totalDocuments,
      unit: '건',
      description: '4대 분야 누적 등록 문서',
      icon: <FileText className="w-5 h-5 text-slate-700" />,
      bgIcon: 'bg-slate-100',
      badgeColor: 'text-slate-700',
    },
    {
      title: '전체 Chunk',
      value: stats.totalChunks,
      unit: '개',
      description: 'pgvector 임베딩 인덱싱 청크',
      icon: <Layers className="w-5 h-5 text-sky-700" />,
      bgIcon: 'bg-sky-50',
      badgeColor: 'text-sky-700',
    },
    {
      title: '인덱싱 완료 문서',
      value: stats.indexedDocuments,
      unit: '건',
      description: '검색 준비 완료된 문서',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-700" />,
      bgIcon: 'bg-emerald-50',
      badgeColor: 'text-emerald-700',
    },
    {
      title: '처리 실패 문서',
      value: stats.errorDocuments,
      unit: '건',
      description: '파싱 또는 임베딩 오류 발생',
      icon: <AlertCircle className="w-5 h-5 text-rose-700" />,
      bgIcon: 'bg-rose-50',
      badgeColor: 'text-rose-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {card.title}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 tracking-tight">
                {card.value.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">{card.unit}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {card.description}
            </div>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bgIcon}`}>
            {card.icon}
          </div>
        </div>
      ))}
    </div>
  );
};
