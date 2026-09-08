'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RagDocument, DomainType } from '@/types/rag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateShort, formatBytes } from '@/lib/utils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  MoreVertical,
  Filter,
  Eye,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

interface DocumentTableProps {
  domain: DomainType;
  documents: RagDocument[];
  onRefresh: () => void;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  domain,
  documents,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // 삭제 대상 모달 상태
  const [deletingDoc, setDeletingDoc] = useState<RagDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 필터링 적용
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.source && doc.source.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.publisher && doc.publisher.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || doc.document_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deletingDoc.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '문서 삭제 실패');
      }
      setDeletingDoc(null);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* 1. 검색 및 필터 툴바 */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="문서명, 출처, 파일명 검색..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">모든 상태</option>
            <option value="UPLOADED">업로드됨</option>
            <option value="PROCESSING">처리중</option>
            <option value="INDEXED">인덱싱 완료</option>
            <option value="ERROR">처리 실패</option>
            <option value="ARCHIVED">보관됨</option>
          </select>

          {/* 자료유형 필터 */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">모든 자료유형</option>
            <option value="논문">논문</option>
            <option value="가이드라인">가이드라인</option>
            <option value="공공기관 자료">공공기관 자료</option>
            <option value="내부 문서">내부 문서</option>
            <option value="기타">기타</option>
          </select>

          <button
            onClick={onRefresh}
            title="새로고침"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors border border-slate-200 bg-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. 문서 목록 테이블 */}
      {filteredDocs.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">등록된 문서가 없습니다.</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            상단의 [자료 등록] 버튼을 눌러 PDF, TXT, Markdown 지식 문서를 업로드해 보세요.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">문서명</th>
                <th className="px-3 py-3">자료유형</th>
                <th className="px-3 py-3">출처 / 기관</th>
                <th className="px-3 py-3">발행일</th>
                <th className="px-3 py-3">업로드일</th>
                <th className="px-3 py-3">상태</th>
                <th className="px-3 py-3 text-center">Chunk 수</th>
                <th className="px-3 py-3 text-center">버전</th>
                <th className="px-5 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* 문서명 및 파일명 */}
                  <td className="px-5 py-3.5 max-w-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline block truncate"
                          title={doc.title}
                        >
                          {doc.title}
                        </Link>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {doc.filename} • {formatBytes(doc.file_size)}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 자료유형 */}
                  <td className="px-3 py-3.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium whitespace-nowrap">
                      {doc.document_type || '기타'}
                    </span>
                  </td>

                  {/* 출처 */}
                  <td className="px-3 py-3.5 text-slate-600 max-w-[150px] truncate">
                    {doc.source || doc.publisher || '-'}
                  </td>

                  {/* 발행일 */}
                  <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">
                    {doc.published_at || '-'}
                  </td>

                  {/* 업로드일 */}
                  <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">
                    {formatDateShort(doc.created_at)}
                  </td>

                  {/* 상태 */}
                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <StatusBadge status={doc.status} />
                  </td>

                  {/* Chunk 수 */}
                  <td className="px-3 py-3.5 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                      <Layers className="w-3 h-3 text-slate-400" />
                      {(doc.chunks_count || 0).toLocaleString()}
                    </span>
                  </td>

                  {/* 버전 */}
                  <td className="px-3 py-3.5 text-center text-slate-500 whitespace-nowrap">
                    v{doc.version || '1.0'}
                  </td>

                  {/* 작업 메뉴 */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        title="상세보기"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>

                      <Link
                        href={`/rag/${domain}/test`}
                        className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-md transition-colors"
                        title="검색 테스트"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={() => setDeletingDoc(doc)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        document={deletingDoc}
        isOpen={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
};
