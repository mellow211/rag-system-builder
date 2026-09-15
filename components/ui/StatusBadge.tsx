import React from 'react';
import { DocumentStatus } from '@/types/rag';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Archive,
  Loader2,
  FileSearch,
  Sparkles,
  Layers,
  Network,
  Cpu,
} from 'lucide-react';

interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  switch (status) {
    case 'UPLOADED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200',
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          업로드됨
        </span>
      );
    case 'EXTRACTING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse',
            className
          )}
        >
          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          텍스트 추출중
        </span>
      );
    case 'ANALYZING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse',
            className
          )}
        >
          <FileSearch className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
          문서 분석중
        </span>
      );
    case 'PROFILE_REVIEW':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200',
            className
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          프로파일 검토 대기
        </span>
      );
    case 'CHUNKING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200',
            className
          )}
        >
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          청크 설계중
        </span>
      );
    case 'CHUNK_REVIEW':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200',
            className
          )}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-500" />
          청크 승인 대기
        </span>
      );
    case 'EMBEDDING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 animate-pulse',
            className
          )}
        >
          <Cpu className="w-3.5 h-3.5 text-teal-500 animate-spin" />
          임베딩 생성중
        </span>
      );
    case 'GRAPH_BUILDING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 animate-pulse',
            className
          )}
        >
          <Network className="w-3.5 h-3.5 text-violet-500 animate-spin" />
          그래프 구축중
        </span>
      );
    case 'GRAPH_REVIEW':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
            className
          )}
        >
          <Network className="w-3.5 h-3.5 text-fuchsia-500" />
          그래프 검토 대기
        </span>
      );
    case 'READY':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs',
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          지식 자산 완성 (READY)
        </span>
      );
    case 'INDEXED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200',
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          인덱싱 완료
        </span>
      );
    case 'PROCESSING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse',
            className
          )}
        >
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          처리중
        </span>
      );
    case 'ERROR':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200',
            className
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          처리 실패
        </span>
      );
    case 'ARCHIVED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200',
            className
          )}
        >
          <Archive className="w-3.5 h-3.5 text-zinc-400" />
          보관됨
        </span>
      );
    default:
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800', className)}>
          {status}
        </span>
      );
  }
};
