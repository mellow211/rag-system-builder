'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DOMAIN_CONFIGS, DomainType } from '@/types/rag';
import { DomainBadge } from '@/components/ui/DomainBadge';
import { Database, ShieldCheck } from 'lucide-react';

export const Header: React.FC = () => {
  const pathname = usePathname();

  // 현재 도메인 탐지
  const matchedDomain = (['health', 'yangsaeng', 'circadian', 'korean-medicine'] as DomainType[]).find(
    (d) => pathname.includes(`/rag/${d}`)
  );

  const getPageTitle = () => {
    if (pathname === '/' || pathname === '/dashboard') return '시스템 종합 대시보드';
    if (pathname.includes('/test')) return 'RAG 지식 검색 검증 테스트';
    if (pathname.startsWith('/documents/')) return '문서 상세 및 청크 검증';
    if (pathname === '/settings') return '시스템 설정 및 환경변수 상태';
    if (matchedDomain) return `${DOMAIN_CONFIGS[matchedDomain].name} 지식베이스 구축·관리`;
    return 'RAG Builder';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          {getPageTitle()}
        </h1>
        {matchedDomain && <DomainBadge domain={matchedDomain} size="sm" />}
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-medium">지식 전용 RAG (개인 건강데이터 미저장)</span>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-slate-500">
          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
            관
          </div>
          <span className="font-medium text-slate-700">지식관리자</span>
        </div>
      </div>
    </header>
  );
};
