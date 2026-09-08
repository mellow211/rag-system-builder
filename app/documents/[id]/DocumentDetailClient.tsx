'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RagDocument, DocumentChunk, DOMAIN_CONFIGS, DomainType } from '@/types/rag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DomainBadge } from '@/components/ui/DomainBadge';
import { DeleteConfirmModal } from '@/components/documents/DeleteConfirmModal';
import { formatDate, formatBytes } from '@/lib/utils';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Search,
  FileText,
  Building,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Code2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DocumentDetailClientProps {
  document: RagDocument;
  domain: DomainType;
  chunks: DocumentChunk[];
}

export const DocumentDetailClient: React.FC<DocumentDetailClientProps> = ({
  document: initialDoc,
  domain,
  chunks: initialChunks,
}) => {
  const router = useRouter();
  const [doc, setDoc] = useState<RagDocument>(initialDoc);
  const [chunks, setChunks] = useState<DocumentChunk[]>(initialChunks);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(
    initialChunks.length > 0 ? initialChunks[0].id : null
  );

  const [isReindexing, setIsReindexing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const config = DOMAIN_CONFIGS[domain];

  // 1. 재인덱싱 핸들러
  const handleReindex = async () => {
    setIsReindexing(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reindex`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '재인덱싱 실패');
      }

      setActionNotice({
        type: 'success',
        message: `재인덱싱이 완료되었습니다. (${data.chunksCount || chunks.length}개 청크 인덱싱됨)`,
      });
      setDoc((prev) => ({ ...prev, status: 'INDEXED' }));
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '재인덱싱 오류';
      setActionNotice({ type: 'error', message: msg });
    } finally {
      setIsReindexing(false);
    }
  };

  // 2. 삭제 핸들러
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '삭제 실패');
      }
      setIsDeleteModalOpen(false);
      router.push(`/rag/${domain}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleChunk = (id: string) => {
    setExpandedChunkId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 1. 상단 내비게이션 및 액션 버튼들 */}
      <div className="flex items-center justify-between">
        <Link
          href={`/rag/${domain}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {config.shortName} 목록으로 돌아가기
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/rag/${domain}/test`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            검색 검증 테스트
          </Link>

          <button
            onClick={handleReindex}
            disabled={isReindexing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
            재인덱싱
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            문서 삭제
          </button>
        </div>
      </div>

      {/* 상태 알림 메시지 */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* 2. 문서 핵심 메타데이터 상세 카드 */}
      <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5 border-l-4 ${config.borderClass}`}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <DomainBadge domain={domain} size="sm" />
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                {doc.document_type || '기타'}
              </span>
              <StatusBadge status={doc.status} />
              <span className="text-xs text-slate-400 font-mono">v{doc.version || '1.0'}</span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {doc.title}
            </h1>

            {typeof doc.metadata?.description === 'string' && doc.metadata.description && (
              <p className="text-xs text-slate-600 leading-relaxed max-w-3xl pt-1">
                {doc.metadata.description}
              </p>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shrink-0 text-right min-w-[140px]">
            <div className="text-xs text-slate-400 font-medium">구축된 청크 수</div>
            <div className="text-2xl font-bold text-slate-900 flex items-center justify-end gap-1 mt-0.5">
              <Layers className="w-5 h-5 text-sky-600" />
              {chunks.length.toLocaleString()}
              <span className="text-xs font-normal text-slate-500">개</span>
            </div>
          </div>
        </div>

        {/* 세부 필드 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">출처 / 기관</span>
            <span className="font-semibold text-slate-800 truncate block">
              {doc.source || doc.publisher || '-'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">발행일</span>
            <span className="font-semibold text-slate-800 block">
              {doc.published_at || '-'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">원본 파일명 / 용량</span>
            <span className="font-semibold text-slate-800 truncate block" title={doc.filename}>
              {doc.filename} ({formatBytes(doc.file_size)})
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">등록 및 업데이트</span>
            <span className="font-semibold text-slate-800 block">
              {formatDate(doc.updated_at || doc.created_at)}
            </span>
          </div>
        </div>

        {doc.error_message && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            <strong>처리 오류 내용:</strong> {doc.error_message}
          </div>
        )}
      </div>

      {/* 3. Chunk 목록 아코디언 뷰어 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>청크 분할 및 지식 단위 목록</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              총 {chunks.length}개
            </span>
          </h2>
          <span className="text-xs text-slate-400">
            원문 텍스트 및 메타데이터를 클릭하여 펼쳐보세요
          </span>
        </div>

        {chunks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">생성된 청크가 없습니다.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              상단의 [재인덱싱] 버튼을 클릭하여 파싱 및 청킹 파이프라인을 실행해 보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {chunks.map((chunk) => {
              const isExpanded = expandedChunkId === chunk.id;
              return (
                <div
                  key={chunk.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs transition-colors"
                >
                  {/* 아코디언 헤더 */}
                  <button
                    type="button"
                    onClick={() => toggleChunk(chunk.id)}
                    className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center font-mono">
                        #{chunk.chunk_index}
                      </span>
                      {chunk.metadata?.page && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                          p.{chunk.metadata.page}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 truncate max-w-md font-mono">
                        {chunk.content.substring(0, 60)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>토큰 추정: {chunk.token_count || '-'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                  </button>

                  {/* 아코디언 본문 */}
                  {isExpanded && (
                    <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-3">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          원문 Chunk Text (content)
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-text font-sans">
                          {chunk.content}
                        </div>
                      </div>

                      {/* 메타데이터 */}
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Code2 className="w-3.5 h-3.5" />
                          <span>Chunk Metadata (JSON)</span>
                        </div>
                        <pre className="p-3 bg-slate-900 text-sky-300 rounded-lg text-[11px] font-mono overflow-x-auto">
                          {JSON.stringify(chunk.metadata || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        document={doc}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
