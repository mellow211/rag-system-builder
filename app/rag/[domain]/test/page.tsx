import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DOMAIN_CONFIGS, DomainType } from '@/types/rag';
import { SearchTestPanel } from '@/components/rag/SearchTestPanel';
import { ArrowLeft, Search, ShieldCheck } from 'lucide-react';

interface SearchTestPageProps {
  params: Promise<{
    domain: string;
  }>;
}

export default async function SearchTestPage({ params }: SearchTestPageProps) {
  const { domain } = await params;
  const validDomains: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];

  if (!validDomains.includes(domain as DomainType)) {
    notFound();
  }

  const domainType = domain as DomainType;
  const config = DOMAIN_CONFIGS[domainType];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 1. 상단 브레드크럼 */}
      <div className="flex items-center justify-between">
        <Link
          href={`/rag/${domain}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {config.shortName} 문서 목록으로 돌아가기
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>지식 전용 RAG 검색 검증 환경</span>
        </div>
      </div>

      {/* 2. 페이지 타이틀 배너 */}
      <div className={`p-6 rounded-2xl border bg-white shadow-xs border-l-4 ${config.borderClass}`}>
        <div className="flex items-center gap-2.5">
          <Search className="w-5 h-5 text-sky-600" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {config.name} 시맨틱 검색 검증
          </h1>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${config.badgeClass}`}>
            Top K 근거 청크 검증
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          자연어 질문을 입력하여 임베딩 및 pgvector HNSW 코사인 유사도 검색을 실행하고, 반환된 근거 Chunk의 정확도와 문서 출처를 검증합니다.
        </p>
      </div>

      {/* 3. 검색 테스트 패널 */}
      <SearchTestPanel initialDomain={domainType} />
    </div>
  );
}
