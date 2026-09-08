'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DomainType, DOMAIN_CONFIGS, RagDocument, RagProject } from '@/types/rag';
import { UploadModal } from '@/components/documents/UploadModal';
import { DocumentTable } from '@/components/documents/DocumentTable';
import { PlusCircle, Search, ArrowLeft, RefreshCw, FolderPlus } from 'lucide-react';

interface DomainClientViewProps {
  domain: DomainType;
  project: RagProject | null;
  initialDocuments: RagDocument[];
}

export const DomainClientView: React.FC<DomainClientViewProps> = ({
  domain,
  project,
  initialDocuments,
}) => {
  const config = DOMAIN_CONFIGS[domain];
  const [documents, setDocuments] = useState<RagDocument[]>(initialDocuments);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents?domain=${domain}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('문서 목록 갱신 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. 상단 네비게이션 및 액션 바 */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          대시보드로 돌아가기
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/rag/${domain}/test`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            {config.shortName} 검색 검증
          </Link>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-sky-400" />
            자료 등록
          </button>
        </div>
      </div>

      {/* 2. 도메인 상단 배너 */}
      <div
        className={`p-6 rounded-2xl border bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 ${config.borderClass}`}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config.primaryHex }}
            />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {config.name}
            </h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${config.badgeClass}`}>
              독립 RAG 공간
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
            {config.description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">등록 문서 총계</div>
            <div className="text-xl font-bold text-slate-900">
              {documents.length.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 ml-1">건</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 문서 목록 Table */}
      <DocumentTable
        domain={domain}
        documents={documents}
        onRefresh={fetchDocuments}
      />

      {/* 4. 자료 등록 모달 */}
      <UploadModal
        currentDomain={domain}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchDocuments}
      />
    </div>
  );
};
