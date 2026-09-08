import React from 'react';
import Link from 'next/link';
import { RagDocument } from '@/types/rag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateShort, formatBytes } from '@/lib/utils';
import { FileText, ArrowRight, ExternalLink } from 'lucide-react';

interface RecentDocumentsProps {
  documents: RagDocument[];
}

export const RecentDocuments: React.FC<RecentDocumentsProps> = ({ documents }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-base">최근 등록 자료</h2>
          <p className="text-xs text-slate-500 mt-0.5">시스템에 최근 등록된 건강지식 원문 및 처리 상태</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-700">아직 등록된 문서가 없습니다.</p>
          <p className="text-xs text-slate-400 mt-1">
            왼쪽 사이드바의 4대 RAG 분야를 선택하여 신규 지식 문서를 업로드해 보세요.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">문서명</th>
                <th className="px-4 py-3">자료유형</th>
                <th className="px-4 py-3">출처/기관</th>
                <th className="px-4 py-3">용량</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">등록일</th>
                <th className="px-5 py-3 text-right">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900 max-w-xs truncate">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate" title={doc.title}>
                        {doc.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                      {doc.document_type || '기타'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 truncate max-w-[140px]">
                    {doc.source || doc.publisher || '-'}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    {formatBytes(doc.file_size)}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                    {formatDateShort(doc.created_at)}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium hover:underline text-xs"
                    >
                      상세보기
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
