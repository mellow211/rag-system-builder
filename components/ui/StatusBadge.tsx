import React from 'react';
import { DocumentStatus } from '@/types/rag';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertCircle, Archive, Loader2 } from 'lucide-react';

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
