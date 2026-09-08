'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Search, 
  Settings, 
  Database,
  HeartPulse,
  Leaf,
  SunMoon,
  Stethoscope,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOMAIN_CONFIGS, DomainType } from '@/types/rag';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  domain?: DomainType;
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const domainItems: { domain: DomainType; icon: React.ReactNode }[] = [
    { domain: 'health', icon: <HeartPulse className="w-4 h-4 text-blue-600" /> },
    { domain: 'yangsaeng', icon: <Leaf className="w-4 h-4 text-emerald-600" /> },
    { domain: 'circadian', icon: <SunMoon className="w-4 h-4 text-orange-600" /> },
    { domain: 'korean-medicine', icon: <Stethoscope className="w-4 h-4 text-purple-600" /> },
  ];

  const isDomainActive = (domain: DomainType) => {
    return pathname.startsWith(`/rag/${domain}`);
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 select-none z-30">
      {/* 로고 & 시스템 타이틀 */}
      <div className="p-5 border-b border-slate-200 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
          <Database className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <div className="font-semibold text-slate-900 text-sm tracking-tight leading-none">
            고령자 건강정보
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1 tracking-tight flex items-center gap-1.5">
            <span>RAG Builder MVP</span>
            <span className="inline-block px-1.5 py-0.2 text-[10px] bg-slate-100 text-slate-600 rounded">v0.1</span>
          </div>
        </div>
      </div>

      {/* 내비게이션 메뉴 */}
      <nav className="flex-1 p-3.5 space-y-6 overflow-y-auto">
        {/* 대시보드 */}
        <div>
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === '/dashboard' || pathname === '/'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>대시보드</span>
          </Link>
        </div>

        {/* RAG 구축 섹션 */}
        <div>
          <div className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5" />
            <span>RAG 지식베이스 구축</span>
          </div>
          <div className="space-y-1">
            {domainItems.map(({ domain, icon }) => {
              const config = DOMAIN_CONFIGS[domain];
              const active = isDomainActive(domain) && !pathname.includes('/test');
              return (
                <Link
                  key={domain}
                  href={`/rag/${domain}`}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group',
                    active
                      ? `${config.bgLightClass} ${config.textClass} font-semibold border ${config.borderClass}`
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {icon}
                    <span>{config.shortName}</span>
                  </div>
                  <ChevronRight
                    className={cn(
                      'w-3.5 h-3.5 transition-transform opacity-0 group-hover:opacity-100',
                      active && 'opacity-100 text-current'
                    )}
                  />
                </Link>
              );
            })}
          </div>
        </div>

        {/* 검색 검증 테스트 섹션 */}
        <div>
          <div className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            <span>RAG 검색 검증</span>
          </div>
          <div className="space-y-1">
            <Link
              href="/rag/health/test"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname.includes('/test')
                  ? 'bg-sky-50 text-sky-800 font-semibold border border-sky-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Search className="w-4 h-4 text-sky-600" />
              <span>검색 테스트</span>
            </Link>
          </div>
        </div>

        {/* 시스템 설정 */}
        <div>
          <div className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            <span>시스템</span>
          </div>
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === '/settings'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <Settings className="w-4 h-4" />
            <span>연동 및 설정</span>
          </Link>
        </div>
      </nav>

      {/* 하단 환경 안내 영역 */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">Supabase pgvector</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ready
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400 truncate">
          HNSW 1536d Cosine Vector
        </div>
      </div>
    </aside>
  );
};
