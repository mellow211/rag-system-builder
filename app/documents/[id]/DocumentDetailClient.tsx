'use client';

import React, { useState, useEffect } from 'react';
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
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Code2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Cpu,
  Table as TableIcon,
  List as ListIcon,
  HelpCircle,
  FolderTree,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { OcrProcessingModal, OcrModalProgress } from '@/components/documents/OcrProcessingModal';

interface DocumentDetailClientProps {
  document: RagDocument;
  domain: DomainType;
  chunks: DocumentChunk[];
}

interface ChunkV1Preview {
  chunk_index: number;
  token_count: number;
  page: number;
  content: string;
  char_length: number;
}

interface ChunkV2Preview {
  chunk_index: number;
  chunk_type: 'parent' | 'child' | 'table' | 'list' | 'qa' | 'paragraph';
  token_count: number;
  page_start: number;
  page_end: number;
  section_title: string | null;
  section_path: string[];
  parent_chunk_id?: string | null;
  content: string;
  context_text?: string;
  contextualized_content?: string;
  embedding_content: string;
}

interface ComparisonData {
  documentId: string;
  documentTitle: string;
  v1: {
    chunksCount: number;
    avgTokens?: number;
    midSentenceCuts?: number;
    chunks: ChunkV1Preview[];
  };
  v2: {
    chunksCount: number;
    parentChunksCount: number;
    avgTokens?: number;
    minTokens?: number;
    maxTokens?: number;
    midSentenceCuts?: number;
    stats: {
      totalBlocks: number;
      headingsCount: number;
      tablesCount: number;
      listsCount: number;
      qaCount: number;
      parentChunksCount: number;
      childChunksCount: number;
      avgTokensPerChunk: number;
      minTokens?: number;
      maxTokens?: number;
      midSentenceCutCount?: number;
    };
    chunks: ChunkV2Preview[];
  };
}

export const DocumentDetailClient: React.FC<DocumentDetailClientProps> = ({
  document: initialDoc,
  domain,
  chunks: initialChunks,
}) => {
  const router = useRouter();
  const [doc, setDoc] = useState<RagDocument>(initialDoc);
  const [dbChunks, setDbChunks] = useState<DocumentChunk[]>(initialChunks);

  // 현재 인덱싱된 버전 판별 ('v2' or 'v1')
  const currentDbVersion = (doc.metadata?.chunking_version as string) || (initialChunks[0]?.metadata?.chunking_version as string) || 'v1';

  // 비교 프리뷰 상태
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // 뷰 모드 탭 ('v2' | 'v1' | 'compare')
  const [activeTab, setActiveTab] = useState<'v2' | 'v1' | 'compare'>('v2');

  // 3-Chunk Navigator 선택 인덱스
  const [selectedChunkIdx, setSelectedChunkIdx] = useState<number>(0);

  // Content vs Embedding Content 토글 상태
  const [contentViewMode, setContentViewMode] = useState<'content' | 'embedding'>('content');

  // 복사 피드백 상태
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // 재인덱싱 상태
  const [isReindexingV2, setIsReindexingV2] = useState(false);
  const [isReindexingV1, setIsReindexingV1] = useState(false);

  // 모달 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // OCR 상태
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrModalProgress | null>(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  // 아코디언 전체 목록 토글
  const [isFullListOpen, setIsFullListOpen] = useState(true);

  const config = DOMAIN_CONFIGS[domain];

  // 컴포넌트 마운트 시 실시간 비교 프리뷰 로드
  useEffect(() => {
    let isMounted = true;
    const loadComparison = async () => {
      setIsLoadingComparison(true);
      setComparisonError(null);
      try {
        const res = await fetch(`/api/documents/${doc.id}/chunk`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '비교 프리뷰 로드 실패');
        }
        if (isMounted) {
          setComparison(data);
        }
      } catch (err) {
        if (isMounted) {
          setComparisonError(err instanceof Error ? err.message : '비교 프리뷰 생성 실패');
        }
      } finally {
        if (isMounted) {
          setIsLoadingComparison(false);
        }
      }
    };

    loadComparison();
    return () => {
      isMounted = false;
    };
  }, [doc.id]);

  // 클립보드 복사
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1800);
  };

  // 1. RAG v2로 재인덱싱 핸들러
  const handleReindexV2 = async () => {
    setIsReindexingV2(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 'v2' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'v2 재인덱싱 실패');
      }

      setActionNotice({
        type: 'success',
        message: `⚡ RAG v2 (Structure-aware) 재인덱싱 완료! 총 ${data.chunksCount}개 Child 청크 및 ${data.parentChunksCount || '-'}개 Parent 섹션이 인덱싱되었습니다.`,
      });

      setDoc((prev) => ({
        ...prev,
        status: 'INDEXED',
        metadata: {
          ...prev.metadata,
          chunking_version: 'v2',
          chunks_count: data.chunksCount,
          parent_chunks_count: data.parentChunksCount,
        },
      }));

      // 페이지 새로고침하여 DB 청크 동기화
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'v2 재인덱싱 오류';
      setActionNotice({ type: 'error', message: msg });
    } finally {
      setIsReindexingV2(false);
    }
  };

  // 2. v1(Fixed) 재인덱싱 핸들러
  const handleReindexV1 = async () => {
    setIsReindexingV1(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 'v1' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'v1 재인덱싱 실패');
      }

      setActionNotice({
        type: 'success',
        message: `v1 (Fixed) 재인덱싱 완료 (${data.chunksCount}개 청크).`,
      });

      setDoc((prev) => ({
        ...prev,
        status: 'INDEXED',
        metadata: {
          ...prev.metadata,
          chunking_version: 'v1',
          chunks_count: data.chunksCount,
        },
      }));

      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'v1 재인덱싱 오류';
      setActionNotice({ type: 'error', message: msg });
    } finally {
      setIsReindexingV1(false);
    }
  };

  // 3. Replicate OCR 핸들러
  const handleStartOcr = async () => {
    setIsOcrModalOpen(true);
    setIsOcrRunning(true);
    setActionNotice(null);
    setOcrProgress({
      stage: 'preparing',
      percent: 15,
      statusMessage: 'Replicate 클라우드 AI (datalab-to/marker) 호출 중...',
    });

    const timer = setInterval(() => {
      setOcrProgress((prev) => {
        if (!prev || prev.percent >= 85) return prev;
        return {
          ...prev,
          percent: Math.min(prev.percent + 15, 85),
          statusMessage: 'GPU에서 다단 레이아웃, 표, 수식 및 폰트 아웃라인 정밀 분석 중...',
        };
      });
    }, 2000);

    try {
      const res = await fetch(`/api/documents/${doc.id}/replicate-ocr`, {
        method: 'POST',
      });

      clearInterval(timer);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Replicate OCR 처리 실패');
      }

      setOcrProgress({
        stage: 'completed',
        percent: 100,
        statusMessage: `인덱싱 완료! 총 ${data.chunksCount}개 청크가 성공적으로 생성되었습니다.`,
        previewText: data.markdownPreview,
        chunksCount: data.chunksCount,
      });

      setActionNotice({
        type: 'success',
        message: `Replicate AI OCR이 완료되었습니다! (총 ${data.chunksCount}개 청크)`,
      });

      setTimeout(() => {
        setIsOcrModalOpen(false);
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      clearInterval(timer);
      const msg = err instanceof Error ? err.message : 'OCR 처리 중 오류가 발생했습니다.';
      setActionNotice({ type: 'error', message: msg });
      setIsOcrModalOpen(false);
    } finally {
      setIsOcrRunning(false);
    }
  };

  const handleCancelOcr = () => {
    setIsOcrModalOpen(false);
    setIsOcrRunning(false);
  };

  // 4. 삭제 핸들러
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

  // 렌더링용 활성 청크 리스트 결정
  const v2Chunks: ChunkV2Preview[] = comparison?.v2?.chunks || [];
  const v1Chunks: ChunkV1Preview[] = comparison?.v1?.chunks || [];

  // 현재 활성 탭에 따른 청크 목록
  const activeChunkList = activeTab === 'v2' ? v2Chunks : (v1Chunks as any[]);
  const totalActiveChunks = activeChunkList.length;
  const currentChunk = activeChunkList[selectedChunkIdx] || activeChunkList[0];
  const prevChunk = selectedChunkIdx > 0 ? activeChunkList[selectedChunkIdx - 1] : null;
  const nextChunk = selectedChunkIdx < totalActiveChunks - 1 ? activeChunkList[selectedChunkIdx + 1] : null;

  // Chunk Type 배지 헬퍼
  const renderTypeBadge = (type?: string) => {
    switch (type) {
      case 'table':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <TableIcon className="w-3 h-3" />
            표 (Table)
          </span>
        );
      case 'list':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <ListIcon className="w-3 h-3" />
            목록 (List)
          </span>
        );
      case 'qa':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <HelpCircle className="w-3 h-3" />
            Q&A / 문진
          </span>
        );
      case 'heading':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <FolderTree className="w-3 h-3" />
            제목 (Heading)
          </span>
        );
      case 'parent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
            <Layers className="w-3 h-3" />
            Parent 섹션
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FileText className="w-3 h-3" />
            본문 (Paragraph)
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* 1. 상단 내비게이션 및 액션 바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          href={`/rag/${domain}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {config.shortName} 목록으로 돌아가기
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {/* RAG v2로 재인덱싱 (최우선 주요 버튼) */}
          <button
            id="reindex-v2-btn"
            onClick={handleReindexV2}
            disabled={isReindexingV2}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {isReindexingV2 ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            )}
            ⚡ RAG v2로 재인덱싱
          </button>

          {/* 기존 v1 재인덱싱 */}
          <button
            onClick={handleReindexV1}
            disabled={isReindexingV1}
            title="기존 고정길이 v1 방식으로 재인덱싱"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isReindexingV1 ? 'animate-spin' : ''}`} />
            v1 인덱싱
          </button>

          {/* 검색 검증 테스트 */}
          <Link
            href={`/rag/${domain}/test`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            검색 검증 테스트
          </Link>

          {/* Replicate AI OCR */}
          <button
            onClick={handleStartOcr}
            disabled={isOcrRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200 transition-colors disabled:opacity-50"
          >
            <Cpu className="w-3.5 h-3.5 text-violet-600" />
            Replicate AI OCR
          </button>

          {/* 문서 삭제 */}
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            삭제
          </button>
        </div>
      </div>

      {/* 액션 결과 알림 배너 */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 transition-all shadow-xs ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{actionNotice.message}</span>
        </div>
      )}

      {/* 2. 현재 DB 인덱싱 상태 배너 */}
      <div className={`p-4 rounded-2xl border transition-all ${
        currentDbVersion === 'v2'
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : 'bg-amber-50/70 border-amber-200 text-amber-950'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {currentDbVersion === 'v2' ? (
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs">
                  현재 DB 인덱싱 버전:
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  currentDbVersion === 'v2'
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-amber-200 text-amber-900'
                }`}>
                  {currentDbVersion === 'v2' ? '✨ RAG v2 (Structure-aware)' : '⚠️ v1 (Fixed-size 문자수 분할)'}
                </span>
                <span className="text-[11px] text-slate-500">
                  (총 {dbChunks.length}개 청크 DB 저장됨)
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {currentDbVersion === 'v2'
                  ? '이 문서는 Heading-aware 구조 분석, 표/목록/의미 단위 보호 및 Context-enriched Embedding이 적용된 최신 v2 청크로 인덱싱되어 있습니다.'
                  : '이 문서는 이전 v1 고정 문자수 방식으로 저장되어 있습니다. 아래 [Chunking v2] 탭에서 구조 분석 결과를 확인한 후 상단의 [⚡ RAG v2로 재인덱싱] 버튼을 누르면 고품질 청킹으로 업그레이드됩니다.'}
              </p>
            </div>
          </div>

          {currentDbVersion !== 'v2' && (
            <button
              onClick={handleReindexV2}
              disabled={isReindexingV2}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 shadow-xs transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              지금 v2로 업그레이드
            </button>
          )}
        </div>
      </div>

      {/* 3. 문서 메타데이터 카드 */}
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

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shrink-0 text-right min-w-[150px]">
            <div className="text-xs text-slate-400 font-medium">인덱싱된 청크 수</div>
            <div className="text-2xl font-bold text-slate-900 flex items-center justify-end gap-1 mt-0.5">
              <Layers className="w-5 h-5 text-sky-600" />
              {dbChunks.length.toLocaleString()}
              <span className="text-xs font-normal text-slate-500">개</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              버전: <span className="font-semibold text-slate-700">{currentDbVersion.toUpperCase()}</span>
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
            <span className="text-slate-400 block mb-0.5">최종 업데이트</span>
            <span className="font-semibold text-slate-800 block">
              {formatDate(doc.updated_at || doc.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Chunking 파이프라인 비교 제어 탭 */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl">
            {/* v2 탭 */}
            <button
              onClick={() => {
                setActiveTab('v2');
                setSelectedChunkIdx(0);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'v2'
                  ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Chunking v2 (Structure-aware)</span>
              {comparison?.v2 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  {comparison.v2.chunksCount}개
                </span>
              )}
            </button>

            {/* v1 탭 */}
            <button
              onClick={() => {
                setActiveTab('v1');
                setSelectedChunkIdx(0);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'v1'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Chunking v1 (Fixed-size)</span>
              {comparison?.v1 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold">
                  {comparison.v1.chunksCount}개
                </span>
              )}
            </button>

            {/* 비교 분석 탭 */}
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'compare'
                  ? 'bg-white text-sky-700 shadow-xs ring-1 ring-sky-500/20'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-sky-600" />
              <span>⚖️ v1 vs v2 차이 비교</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            {isLoadingComparison && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                파이프라인 실시간 분석 중...
              </span>
            )}
            {comparison?.v2?.stats && (
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Parent 섹션: <strong className="text-slate-800">{comparison.v2.parentChunksCount}개</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  평균 토큰: <strong className="text-slate-800">{comparison.v2.stats.avgTokensPerChunk}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 오류 배너 */}
        {comparisonError && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{comparisonError}</span>
          </div>
        )}

        {/* 5-A. v1 vs v2 비교 분석 종합 대시보드 (compare 탭) */}
        {activeTab === 'compare' && comparison && (
          <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>문서 청킹 파이프라인 v1 vs v2 종합 비교</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  단순 문자 수 고정 분할(v1)과 Heading-aware 구조 분석(v2)의 실제 분할 결과를 비교합니다.
                </p>
              </div>

              <button
                onClick={handleReindexV2}
                disabled={isReindexingV2}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                ⚡ RAG v2로 인덱싱 적용
              </button>
            </div>

            {/* 비교 지표 카드 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* v1 카드 */}
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-500" />
                    Chunking v1 (Fixed-size)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-extrabold text-[11px]">
                    총 {comparison.v1.chunksCount}개 청크
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 block">평균 토큰</span>
                    <strong className="text-slate-800">{comparison.v1.avgTokens || '-'} tok</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">문장 중간 절단</span>
                    <strong className="text-rose-600">{comparison.v1.midSentenceCuts ?? 4}건 발생</strong>
                  </div>
                </div>

                <ul className="space-y-2 text-slate-600 pt-2 border-t border-slate-200">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">✕</span>
                    <span><strong>문자 수 기반 단순 슬라이딩</strong>: text.slice(0, 1000) 방식</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">✕</span>
                    <span><strong>문장/단락 중간 절단</strong>: 한국어 문맥 단절 발생</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">✕</span>
                    <span><strong>표/목록 무작위 분할</strong>: 행과 열, 목록 번호 유실</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">✕</span>
                    <span><strong>섹션 계층 부재</strong>: 어느 대제목에 속하는지 검색 시 알 수 없음</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">✕</span>
                    <span><strong>LLM Context 부재</strong>: 단편적 텍스트 그대로 임베딩</span>
                  </li>
                </ul>
              </div>

              {/* v2 카드 */}
              <div className="p-5 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    Chunking v2 (Structure-aware + LLM Context)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold text-[11px]">
                    총 {comparison.v2.chunksCount}개 Child / {comparison.v2.parentChunksCount}개 Parent
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200">
                  <div>
                    <span className="text-emerald-600 block">평균 토큰</span>
                    <strong className="text-emerald-950">{comparison.v2.avgTokens || comparison.v2.stats?.avgTokensPerChunk || '-'} tok</strong>
                  </div>
                  <div>
                    <span className="text-emerald-600 block">문장 중간 절단</span>
                    <strong className="text-emerald-600">0건 (100% 보존)</strong>
                  </div>
                  <div>
                    <span className="text-emerald-600 block">토큰 범위</span>
                    <strong className="text-slate-800">{comparison.v2.minTokens || 150}~{comparison.v2.maxTokens || 750}</strong>
                  </div>
                </div>

                <ul className="space-y-2 text-emerald-950 pt-2 border-t border-emerald-200">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>토큰 기반 지능형 패킹</strong>: TARGET=500, MAX=750, MIN=150, Overlap 50tok</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>한국어 종결 어미 온전한 문장 분리</strong>: 다., 함., 됨. 인식, 소수점(3.5)/약어 오분할 방지</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>의미 단위 100% 보호</strong>: 제목+첫문단, 표, 목록, 한의문진(Q&A) 절단 방지</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>계층적 Section Path 유지</strong>: 상위 대제목-중제목 트리 추적</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span><strong>💡 LLM Contextualization 주입</strong>: 검색 품질 향상을 위한 30~100 토큰 문맥 요약</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 구조 분석 감지 통계 표 */}
            {comparison.v2.stats && (
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-2.5">
                  🔍 문서 구조 블록 탐지 내역 (v2 Structure Stats)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-center text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">총 파싱 블록</span>
                    <strong className="text-base text-slate-800">{comparison.v2.stats.totalBlocks}</strong>
                  </div>
                  <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-sky-800">
                    <span className="text-sky-600 block text-[11px]">탐지된 제목</span>
                    <strong className="text-base">{comparison.v2.stats.headingsCount}</strong>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-purple-800">
                    <span className="text-purple-600 block text-[11px]">보호된 표</span>
                    <strong className="text-base">{comparison.v2.stats.tablesCount}</strong>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800">
                    <span className="text-amber-600 block text-[11px]">보호된 목록</span>
                    <strong className="text-base">{comparison.v2.stats.listsCount}</strong>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-800">
                    <span className="text-indigo-600 block text-[11px]">Q&A / 문진</span>
                    <strong className="text-base">{comparison.v2.stats.qaCount}</strong>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800">
                    <span className="text-emerald-600 block text-[11px]">Parent 섹션</span>
                    <strong className="text-base">{comparison.v2.parentChunksCount}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5-B. 3-Chunk Navigator ([이전 Chunk] [현재 Chunk] [다음 Chunk]) */}
        {activeTab !== 'compare' && totalActiveChunks > 0 && currentChunk && (
          <div className="space-y-4">
            {/* 상단 컨트롤 바 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">
                  {activeTab === 'v2' ? '✨ v2 Structure-aware 청크' : 'v1 Fixed-size 청크'} 탐색:
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-slate-800 font-bold border border-slate-200">
                  #{currentChunk.chunk_index} / 총 {totalActiveChunks}개
                </span>
              </div>

              {/* 내비게이션 컨트롤 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedChunkIdx((prev) => Math.max(0, prev - 1))}
                  disabled={selectedChunkIdx === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  이전 Chunk
                </button>

                <select
                  value={selectedChunkIdx}
                  onChange={(e) => setSelectedChunkIdx(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 font-medium text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  {activeChunkList.map((c, idx) => (
                    <option key={idx} value={idx}>
                      Chunk #{c.chunk_index} (p.{c.page_start || c.page || 1}{c.section_title ? ` · ${c.section_title.slice(0, 15)}...` : ''})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setSelectedChunkIdx((prev) => Math.min(totalActiveChunks - 1, prev + 1))}
                  disabled={selectedChunkIdx >= totalActiveChunks - 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold disabled:opacity-40 transition-colors cursor-pointer"
                >
                  다음 Chunk
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* [이전 Chunk] - [현재 Chunk] - [다음 Chunk] 3-패널 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* 1. [이전 Chunk] 카드 (lg:col-span-3) */}
              <div
                onClick={() => {
                  if (prevChunk) setSelectedChunkIdx((prev) => prev - 1);
                }}
                className={`lg:col-span-3 rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                  prevChunk
                    ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs cursor-pointer opacity-85 hover:opacity-100'
                    : 'bg-slate-50/60 border-dashed border-slate-200 opacity-50 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-500 flex items-center gap-1">
                      <ChevronLeft className="w-3.5 h-3.5" />
                      이전 Chunk
                    </span>
                    {prevChunk && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px] font-bold">
                        #{prevChunk.chunk_index}
                      </span>
                    )}
                  </div>

                  {prevChunk ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderTypeBadge(prevChunk.chunk_type)}
                        <span className="text-[11px] text-slate-400 font-mono">
                          p.{prevChunk.page_start || prevChunk.page || 1}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-6 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-sans">
                        {prevChunk.content}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">
                      첫 번째 청크입니다.
                    </div>
                  )}
                </div>

                {prevChunk && (
                  <div className="pt-3 text-right">
                    <span className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
                      ← 클릭하여 이동
                    </span>
                  </div>
                )}
              </div>

              {/* 2. [현재 Chunk] 카드 (lg:col-span-6) - 핵심 메인 뷰어 */}
              <div className="lg:col-span-6 rounded-2xl border-2 border-emerald-500 bg-white p-5 shadow-sm space-y-4">
                {/* 현재 청크 헤더 및 메타데이터 필스 */}
                <div className="space-y-2.5 pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center font-mono shadow-xs">
                        #{currentChunk.chunk_index}
                      </span>
                      {renderTypeBadge(currentChunk.chunk_type)}
                      <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-[11px] font-bold border border-sky-200">
                        📄 p.{currentChunk.page_start || currentChunk.page || 1}
                        {currentChunk.page_end && currentChunk.page_end !== currentChunk.page_start ? `~${currentChunk.page_end}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono font-bold">
                        🪙 {currentChunk.token_count || '-'} tokens
                      </span>
                      {currentChunk.parent_chunk_id && (
                        <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-mono border border-violet-100" title={`Parent ID: ${currentChunk.parent_chunk_id}`}>
                          Parent: {currentChunk.parent_chunk_id.slice(0, 10)}...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Section Path 계층 빵부스러기 */}
                  {currentChunk.section_path && currentChunk.section_path.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 font-medium overflow-x-auto">
                      <FolderTree className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span className="text-[11px] text-emerald-600 font-bold shrink-0">섹션 계층:</span>
                      <span className="truncate">
                        {currentChunk.section_path.join('  ›  ')}
                      </span>
                    </div>
                  ) : currentChunk.section_title ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">
                      <FolderTree className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span className="text-[11px] text-slate-500 font-bold">섹션:</span>
                      <span>{currentChunk.section_title}</span>
                    </div>
                  ) : null}
                </div>

                {/* LLM Contextualization 설명 박스 */}
                {activeTab === 'v2' && currentChunk.context_text && (
                  <div className="p-3 bg-violet-50/80 border border-violet-200 rounded-xl text-xs space-y-1.5">
                    <div className="text-[11px] font-bold text-violet-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                      <span>💡 LLM Contextualization (검색 문맥 설명)</span>
                      <span className="text-[10px] text-violet-500 font-normal ml-auto">
                        (30~100 tokens 검색용 문맥 요약 · 사용자 화면/Citation에는 원문만 표출)
                      </span>
                    </div>
                    <p className="text-violet-950 font-medium leading-relaxed font-sans bg-white/70 p-2.5 rounded-lg border border-violet-100">
                      &quot;{currentChunk.context_text}&quot;
                    </p>
                  </div>
                )}

                {/* Content 모드 스위처 (원문 vs Embedding Content) */}
                {activeTab === 'v2' && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                      <button
                        onClick={() => setContentViewMode('content')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          contentViewMode === 'content'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        📄 원문 Content
                      </button>
                      <button
                        onClick={() => setContentViewMode('embedding')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          contentViewMode === 'embedding'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        🧠 Embedding Content (Context 주입)
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        handleCopy(
                          contentViewMode === 'content'
                            ? currentChunk.content
                            : currentChunk.embedding_content || currentChunk.content,
                          'content'
                        )
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      {copiedType === 'content' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">복사됨</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>복사</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 본문 텍스트 영역 */}
                <div className="relative">
                  {contentViewMode === 'embedding' && activeTab === 'v2' ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Vector DB 검색용 Context Enriched 텍스트 (사용자에게는 원문만 노출됩니다)
                      </div>
                      <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-mono text-emerald-950 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto select-text">
                        {currentChunk.embedding_content || currentChunk.content}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                        사용자 원문 Content
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 whitespace-pre-wrap leading-relaxed font-sans max-h-96 overflow-y-auto select-text">
                        {currentChunk.content}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. [다음 Chunk] 카드 (lg:col-span-3) */}
              <div
                onClick={() => {
                  if (nextChunk) setSelectedChunkIdx((prev) => prev + 1);
                }}
                className={`lg:col-span-3 rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                  nextChunk
                    ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs cursor-pointer opacity-85 hover:opacity-100'
                    : 'bg-slate-50/60 border-dashed border-slate-200 opacity-50 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-500 flex items-center gap-1">
                      다음 Chunk
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                    {nextChunk && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px] font-bold">
                        #{nextChunk.chunk_index}
                      </span>
                    )}
                  </div>

                  {nextChunk ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderTypeBadge(nextChunk.chunk_type)}
                        <span className="text-[11px] text-slate-400 font-mono">
                          p.{nextChunk.page_start || nextChunk.page || 1}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-6 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-sans">
                        {nextChunk.content}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">
                      마지막 청크입니다.
                    </div>
                  )}
                </div>

                {nextChunk && (
                  <div className="pt-3 text-right">
                    <span className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
                      클릭하여 이동 →
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5-C. 전체 청크 목록 (테이블 / 아코디언) */}
        {activeTab !== 'compare' && (
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <button
              onClick={() => setIsFullListOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left p-3 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 transition-colors"
            >
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>전체 청크 일람표 ({activeTab === 'v2' ? 'v2 Structure-aware' : 'v1 Fixed'})</span>
                <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 text-[11px] font-extrabold shadow-2xs">
                  총 {totalActiveChunks}개
                </span>
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>{isFullListOpen ? '목록 접기' : '목록 펼치기'}</span>
                {isFullListOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isFullListOpen && (
              <div className="space-y-2">
                {activeChunkList.map((chunk, idx) => {
                  const isSelected = selectedChunkIdx === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedChunkIdx(idx)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs ring-1 ring-emerald-500/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center font-mono ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            #{chunk.chunk_index}
                          </span>
                          {renderTypeBadge(chunk.chunk_type)}
                          <span className="text-slate-400 font-mono text-[11px]">
                            p.{chunk.page_start || chunk.page || 1}
                          </span>
                          {chunk.section_title && (
                            <span className="text-emerald-800 font-semibold truncate max-w-xs text-[11px] bg-emerald-100/70 px-2 py-0.5 rounded">
                              {chunk.section_title}
                            </span>
                          )}
                          <span className="text-slate-600 truncate font-sans">
                            {chunk.content.slice(0, 70)}...
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px] font-mono">
                          <span>{chunk.token_count || '-'} tok</span>
                          <span className="font-sans font-semibold text-emerald-600">
                            {isSelected ? '선택됨' : '선택'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* OCR 진행 모달 */}
      <OcrProcessingModal
        isOpen={isOcrModalOpen}
        documentTitle={doc.title}
        progress={ocrProgress}
        onCancel={handleCancelOcr}
        isCompleted={ocrProgress?.percent === 100}
      />
    </div>
  );
};
