import React from 'react';
import Link from 'next/link';
import { getDashboardStats } from '@/lib/supabase/stats';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { DomainCard } from '@/components/dashboard/DomainCard';
import { OverallStats } from '@/components/dashboard/OverallStats';
import { RecentDocuments } from '@/components/dashboard/RecentDocuments';
import { DomainType } from '@/types/rag';
import { Database, AlertTriangle, Sparkles, FolderPlus, Search, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const isConfigured = isSupabaseAdminConfigured();
  const stats = await getDashboardStats();

  const domainList: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* 1. 상단 안내 헤더 & 상태 배너 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full w-fit mb-2 border border-sky-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>고령자 건강정보 RAG 구축·관리 포털</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            분야별 RAG 지식베이스 관리 대시보드
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            건강정보, 양생, 일주기리듬, 한의문진 4개 독립 지식 공간의 문서 정제, 청킹, 임베딩 및 인덱싱 상태를 종합 관리합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/rag/health"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            자료 등록하기
          </Link>
          <Link
            href="/rag/health/test"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Search className="w-4 h-4 text-slate-500" />
            검색 검증
          </Link>
        </div>
      </div>

      {/* Supabase 미연결 안내 배너 */}
      {!isConfigured && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-bold text-amber-900">
              Supabase 환경변수 연결 대기 중 (.env.local)
            </div>
            <p className="text-amber-700 leading-relaxed">
              현재는 <strong>플레이스홀더 설정</strong>으로 화면 레이아웃 및 4대 도메인 템플릿이 표시되고 있습니다.
              실제 PostgreSQL DB 및 Storage, pgvector를 연동하려면 프로젝트 루트의{' '}
              <code className="px-1.5 py-0.5 bg-amber-100 rounded font-mono text-[11px]">.env.local</code>에
              Supabase URL과 Service Role Key를 설정하고{' '}
              <code className="px-1.5 py-0.5 bg-amber-100 rounded font-mono text-[11px]">
                supabase/migrations/001_initial_schema.sql
              </code>
              을 실행하세요.
            </p>
          </div>
        </div>
      )}

      {/* 2. 시스템 전체 통계 (전체 문서, 전체 Chunk, 인덱싱 완료, 처리 실패) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            전체 시스템 지표
          </h2>
          <span className="text-xs text-slate-400">실시간 집계 기준</span>
        </div>
        <OverallStats stats={stats} />
      </section>

      {/* 3. 4대 분야별 RAG 지식베이스 현황 카드 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            4대 분야별 RAG 현황
          </h2>
          <span className="text-xs text-slate-400">각 도메인은 독립된 RAG 공간으로 운영됩니다</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {domainList.map((domain) => (
            <DomainCard key={domain} stats={stats.domainStats[domain]} />
          ))}
        </div>
      </section>

      {/* 4. 최근 등록 문서 목록 */}
      <section className="space-y-3">
        <RecentDocuments documents={stats.recentDocuments} />
      </section>
    </div>
  );
}
